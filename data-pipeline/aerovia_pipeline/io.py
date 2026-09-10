"""Portable acquisition, atomic exports and content integrity checks."""
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import csv
import json
import os
import tempfile
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .model import NetworkError, validate_network, assemble, build_result
import numpy as np

MAX_INPUT_BYTES = 5 * 1024 * 1024


def digest(value):
    return sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix=".aerovia-", suffix=".tmp", delete=False) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def load_networks(path):
    path = Path(path)
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise NetworkError("Network input exceeds 5 MiB")
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"), parse_constant=lambda value: (_ for _ in ()).throw(NetworkError(f"Non-finite JSON value {value}")))
    except (json.JSONDecodeError, UnicodeError) as exc:
        raise NetworkError(f"Input must be valid UTF-8 JSON: {exc}") from exc
    if isinstance(payload, dict) and "network" in payload:
        payload = payload["network"]
    networks = payload if isinstance(payload, list) else [payload]
    if not 1 <= len(networks) <= 100:
        raise NetworkError("Input must contain 1-100 networks")
    identifiers = set()
    for network in networks:
        validate_network(network)
        if network["id"] in identifiers:
            raise NetworkError("Network identifiers must be unique within a catalog")
        identifiers.add(network["id"])
    return networks


def project_options(path):
    """Read browser-exported state after load_networks has bounded and validated JSON."""
    payload=json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if isinstance(payload,dict) and payload.get("schema")=="aerovia.project/v1":
        options=payload.get("options",{})
        if not isinstance(options,dict):
            raise NetworkError("Project options must be an object")
        validate_network(payload["network"],options)
        return options
    return {}


def fetch_network(url, expected_sha256, output):
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise NetworkError("Use a public HTTPS source URL without embedded credentials")
    if len(expected_sha256) != 64 or any(c not in "0123456789abcdefABCDEF" for c in expected_sha256):
        raise NetworkError("An exact expected SHA-256 checksum is required")
    request = Request(url, headers={"User-Agent": "Aerovia-offline-pipeline/0.1", "Accept": "application/json"})
    with urlopen(request, timeout=30) as response:
        if urlparse(response.url).scheme != "https":
            raise NetworkError("Redirects must retain HTTPS")
        payload = response.read(MAX_INPUT_BYTES + 1)
    if len(payload) > MAX_INPUT_BYTES:
        raise NetworkError("Downloaded network exceeds 5 MiB")
    actual = sha256(payload).hexdigest()
    if actual.lower() != expected_sha256.lower():
        raise NetworkError("Downloaded content checksum does not match expected SHA-256")
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, prefix=".aerovia-download-", delete=False) as handle:
        handle.write(payload)
        temporary = Path(handle.name)
    try:
        load_networks(temporary)
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    # The URL may include private query data; receipts persist only content identity.
    return {"sha256":actual,"bytes":len(payload),"validated":True}


def export_csv(path, network, result, ensemble=None, options=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["edge_id", "kind", "from_node", "to_node", "area_m2", "resistance_Pa_s2_m6", "target_m3_s", "flow_m3_s", "velocity_m_s", "shortfall_m3_s", "closed", "flow_p05_m3_s", "flow_p50_m3_s", "flow_p95_m3_s", "target_probability"])
        for i, edge in enumerate(network["edges"]):
            option = (options or {}).get("overrides",{}).get(edge["id"],{})
            writer.writerow([edge["id"],edge["kind"],edge["from"],edge["to"],option.get("area",edge["area"]),option.get("resistance",edge["resistance"])*(options or {}).get("resistanceScale",1),option.get("target",edge["target"]),result["flows"][i],result["velocities"][i],result["shortfalls"][i],option.get("closed",False),
                             *([ensemble[k][i] for k in ("flowP05","flowP50","flowP95","targetProbability")] if ensemble else ["","","",""])])


def write_manifest(directory, metadata):
    directory = Path(directory)
    files = {}
    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.name != "manifest.json":
            files[path.relative_to(directory).as_posix()] = {"sha256":sha256(path.read_bytes()).hexdigest(),"bytes":path.stat().st_size}
    manifest = {"schema":"aerovia.manifest/v1","createdAt":utc_now(),"files":files,**metadata}
    write_json(directory / "manifest.json", manifest)
    return manifest


def verify_artifacts(directory):
    directory = Path(directory).resolve()
    manifest = json.loads((directory/"manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != "aerovia.manifest/v1" or not manifest.get("files"):
        raise NetworkError("Missing versioned artifact manifest")
    for filename, spec in manifest["files"].items():
        path = (directory/filename).resolve()
        if not path.is_relative_to(directory) or not path.is_file():
            raise NetworkError("Manifest path missing or outside artifact directory")
        if path.stat().st_size != spec["bytes"] or sha256(path.read_bytes()).hexdigest() != spec["sha256"]:
            raise NetworkError(f"Integrity mismatch: {filename}")
    catalog = json.loads((directory/"catalog.json").read_text(encoding="utf-8"))
    if catalog.get("schema") != "aerovia.catalog/v1" or not catalog.get("cases"):
        raise NetworkError("Invalid catalog schema or empty case list")
    for case in catalog["cases"]:
        network,result,options = case["network"],case["result"],case.get("options",{})
        validate_network(network,options)
        if case.get("sourceSha256") != digest(network):
            raise NetworkError("Case source hash differs from embedded input")
        if case.get("optionsSha256") != digest(options):
            raise NetworkError("Case options hash differs from embedded scenario options")
        if result.get("schema") != "aerovia.result/v1" or not result.get("converged"):
            raise NetworkError("Catalog contains an unaccepted result")
        if len(result["flows"])!=len(network["edges"]) or len(result["pressures"])!=len(network["nodes"]):
            raise NetworkError("Result dimensions do not match network")
        model=assemble(network,options)
        recomputed=build_result(network,options,model,np.array(result["flows"])[model["active"]],np.array(result["pressures"]),0,0)
        if not recomputed["converged"]:
            raise NetworkError("Exported flows fail physical residual checks")
        for field in ("fanPowerKW","totalIntake","targetRatio"):
            if not np.isclose(result[field],recomputed[field],rtol=1e-8,atol=1e-8):
                raise NetworkError(f"Exported {field} does not match equations")
        if "ensemble" in case:
            ensemble=case["ensemble"]
            if ensemble["failures"] or ensemble["parityMaxAbsFlow"]>1e-4:
                raise NetworkError("Ensemble failure or CPU/device parity gate not satisfied")
            for field in ("flowP05","flowP50","flowP95","targetProbability"):
                values=np.asarray(ensemble[field])
                if values.shape!=(len(network["edges"]),) or not np.all(np.isfinite(values)):
                    raise NetworkError("Ensemble dimensions or finite values invalid")
            if np.any(np.array(ensemble["flowP05"])>ensemble["flowP50"]) or np.any(np.array(ensemble["flowP50"])>ensemble["flowP95"]):
                raise NetworkError("Ensemble quantiles are not ordered")
            if any(not 0 <= x <= 1 for x in ensemble["targetProbability"]):
                raise NetworkError("Invalid target probability")
    return {"verifiedFiles":len(manifest["files"]),"verifiedCases":len(catalog["cases"]),"schema":catalog["schema"]}

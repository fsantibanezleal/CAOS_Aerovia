"""CPU-only verification of public learned assets; no PyTorch installation required."""
from pathlib import Path
import json
import numpy as np
from .model import NetworkError
from .surrogate_data import METHODS, REGIMES, file_identity
from .io import digest, load_networks
from .model import assemble, build_result

def validate_models(directory, source_identity=None):
    directory = Path(directory).resolve()
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    registry = json.loads((directory / "registry.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != "aerovia.model-manifest/v1" or registry.get("schema") != "aerovia.model-registry/v1":
        raise NetworkError("Invalid model registry/manifest schema")
    if source_identity and registry.get("sourceSha256") != source_identity:
        raise NetworkError("Model source identity mismatch")
    expected = set(manifest["files"]) | {"manifest.json"}
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob("*") if p.is_file()}
    if actual != expected:
        raise NetworkError("Unowned or missing model files")
    for name, expected in manifest["files"].items():
        target = (directory / name).resolve()
        if directory not in target.parents or target.is_symlink() or file_identity(target) != expected:
            raise NetworkError("Model file path or checksum mismatch")
    identities = [(e["methodId"], e["networkId"]) for e in registry["entries"]]
    if len(identities) != len(set(identities)):
        raise NetworkError("Duplicate model registry entry")
    for entry in registry["entries"]:
        if entry["methodId"] not in METHODS or entry["status"] != "implemented":
            raise NetworkError("Unimplemented method in release registry")
        for key in ("checkpoint", "onnx"):
            spec = entry[key]
            if manifest["files"].get(spec["file"]) != {k:spec[k] for k in ("sha256","bytes")}:
                raise NetworkError("Registry asset checksum does not match model manifest")
    return {"models": len(identities), "files": len(actual), "sourceSha256": registry["sourceSha256"]}


def validate_release(models_output, science_output, input_path=None):
    science = json.loads(Path(science_output).read_text(encoding="utf-8"))
    if science.get("schema") != "aerovia.science/v1":
        raise NetworkError("Invalid science schema")
    result = validate_models(models_output, science["sourceSha256"])
    networks = None
    if input_path is not None:
        source = load_networks(input_path)
        if digest(source) != science["sourceSha256"]:
            raise NetworkError("Canonical input identity differs from the learned release")
        networks = {network["id"]:network for network in source}
    case_ids = {case["networkId"] for case in science["cases"]}
    if len(case_ids) != len(science["cases"]):
        raise NetworkError("Duplicate science case")
    count = 0
    for case in science["cases"]:
        if {r["id"] for r in case["regimes"]} != {r["id"] for r in REGIMES}:
            raise NetworkError("Missing regime in science replay")
        for regime in case["regimes"]:
            if not regime["reference"]["converged"] or set(regime["predictions"]) != set(METHODS):
                raise NetworkError("Incomplete replay method matrix")
            q_ref = np.asarray(regime["reference"]["flows"])
            if networks is not None:
                network = networks[case["networkId"]]
                if digest(network) != case["sourceSha256"]:
                    raise NetworkError("Per-case learned source identity mismatch")
                model = assemble(network,regime["options"])
            for prediction in regime["predictions"].values():
                q = np.asarray(prediction["result"]["flows"])
                if q.shape != q_ref.shape or not np.all(np.isfinite(q)):
                    raise NetworkError("Invalid learned flow dimensions/values")
                expected = q-q_ref
                if not np.allclose(expected,prediction["errors"],rtol=0,atol=1e-10) or abs(float(np.mean(np.abs(expected)))-prediction["metrics"]["flowMAE"])>1e-10:
                    raise NetworkError("Replay metrics do not match actual prediction arrays")
                if networks is not None:
                    recalculated = build_result(network,regime["options"],model,q,np.asarray(prediction["result"]["pressures"]),0,0)
                    for key in ("massResidual","pressureResidual","fanPowerKW","totalIntake","targetRatio"):
                        if not np.isclose(recalculated[key],prediction["result"][key],rtol=1e-7,atol=1e-7):
                            raise NetworkError(f"Learned derived scalar differs from exported arrays: {key}")
                count += 1
    complete = science["benchmark"]["completeness"]
    if complete["missingCells"] != 0 or complete["actualCells"] != complete["expectedCells"]:
        raise NetworkError("Incomplete held-out benchmark")
    return {**result, "cases": len(case_ids), "regimes": len(REGIMES), "learnedReplayCells": count, "benchmarkCells": complete["actualCells"]}

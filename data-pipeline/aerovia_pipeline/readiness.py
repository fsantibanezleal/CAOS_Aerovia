"""The readiness document (catalog row readiness, ADR-0080 decisions 3 and 4): what is real in this build, computed from
docs/contracts/catalog.md and the repository state, never written by hand.

A pure function of its inputs: no clock, no randomness, rows in catalog order, ``missing`` sorted. The rules, their order
(first match wins) and their reasons are the catalog's ``## Missing-data states`` table; tests/contracts/test_readiness.py
parses that table and holds every reason here to it. Stdlib only (no numpy, no torch, no bake), so scripts/check_readiness.py
runs in CI with nothing installed.
"""
import hashlib
import json
import os
import tempfile
from pathlib import Path

from . import __version__ as ENGINE_VERSION

SCHEMA = "aerovia.readiness/v1"
CATALOG_REL = "docs/contracts/catalog.md"
STATUSES = ("real", "active")  # the catalog's status vocabulary, exactly, lower case
RUNTIME = ("engine-worker", "transport", "project", "release-identity")  # exchanged at run time or written at build
BAKE_GROUP = ("catalog", "reference-checks", "branch-table", "artifact-manifest")  # one bake writes these
STALE_ROWS = ("catalog", "artifact-manifest")  # the rows that carry the engine version
MODEL_FILES = {"model-io": ".onnx", "checkpoint": ".pt"}  # row -> the suffix of the model files the manifest lists
DOCUMENT = {  # row -> the committed path (relative to data/) that proves the row is present
    "network": "cases.json", "catalog": "artifacts/catalog.json", "reference-checks": "artifacts/reference-checks.json",
    "science": "artifacts/science.json", "artifact-manifest": "artifacts/manifest.json", "browser-evidence": "models/browser-evidence.json",
    "model-manifest": "models/manifest.json", "model-registry": "models/registry.json", "onnx-parity": "models/parity-fixtures.json",
    "model-io": "models/manifest.json", "checkpoint": "models/manifest.json",
}

# the catalog's reasons as (en, es) templates, in the order of its Missing-data table
PROVIDER_VERSION = "%d.%02d.%03d" % (0, 0, 0)  # the provider tree is bound to no real build (a tuple, not a literal: the version guard reads literals)

T_PROVIDER = ("Served by its provider ({provider}); the real producer is not built yet.",
              "Lo sirve su proveedor ({provider}); el productor real aún no está construido.")
T_RUNTIME = ("Exchanged at run time or written at build; the static document carries none.",
             "Se intercambia en ejecución o se escribe en la compilación; el documento estático no lo incluye.")
T_NOT_BAKED = ("The pipeline has not baked this build.", "El pipeline no ha generado esta versión.")
T_NETWORKS = ("{n} of {total} networks the catalog lists are absent.", "Faltan {n} de {total} redes que lista el catálogo.")
T_MODELS = ("{n} of {total} model files the manifest lists are absent.", "Faltan {n} de {total} archivos de modelo que lista el manifiesto.")
T_STALE = ("Baked by engine {engine_version}; the pipeline is {version}.", "Generado por el motor {engine_version}; el pipeline es {version}.")
T_ABSENT = ("The committed document is absent.", "El documento versionado no está.")


def parse_catalog(text):
    """The rows of the ``## Contracts`` table, one dict per row keyed by the lower-cased header cells."""
    lines = text.replace("\r\n", "\n").split("\n")
    start = next(i for i, ln in enumerate(lines) if ln.strip() == "## Contracts")
    table = []
    for ln in lines[start + 1:]:
        if ln.startswith("## "):
            break
        if ln.startswith("|"):
            table.append([c.strip() for c in ln.strip().strip("|").split("|")])
    header = [c.lower() for c in table[0]]
    return [dict(zip(header, cells)) for cells in table[2:]]  # table[1] is the separator


def _fill(template, **values):
    out = []
    for text in template:
        for key, value in values.items():
            text = text.replace("{" + key + "}", str(value))
        out.append(text)
    return {"en": out[0], "es": out[1]}


def _json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


class _Facts:
    """What the repository says, read once."""

    def __init__(self, root):
        data = root / "data"
        self.data = data
        self.catalog = _json(data / "artifacts" / "catalog.json")
        self.catalog = self.catalog if isinstance(self.catalog, dict) else None
        cases = _json(data / "cases.json")
        self.cases = cases if isinstance(cases, list) else None
        self.engine_version = str(((self.catalog or {}).get("benchmark") or {}).get("engineVersion", ""))
        listed = [c["network"]["id"] for c in (self.catalog or {}).get("cases", []) if isinstance(c.get("network"), dict)]
        present = {n.get("id") for n in (self.cases or []) if isinstance(n, dict)}
        self.networks_total = len(listed)
        self.networks_missing = sorted(i for i in listed if i not in present)
        manifest = _json(data / "models" / "manifest.json")
        self.manifest = manifest if isinstance(manifest, dict) else None
        self.model_files = sorted((self.manifest or {}).get("files", {}))

    def models(self, suffix):
        listed = [f for f in self.model_files if f.endswith(suffix)]
        return listed, sorted(f for f in listed if not (self.data / "models" / f).is_file())


def _entry(row, state, provenance, reason, missing=None):
    return {"id": row["id"], "version": row["version"], "status": row["status"], "provenance": provenance,
            "state": state, "reason": reason, "missing": sorted(missing or [])}


def _rule(row, f, version):
    """The first rule of the catalog's Missing-data table that matches ``row``."""
    rid = row["id"]
    provider = row.get("provider", "").replace("`", "")
    if row["status"] not in STATUSES:
        raise ValueError(f"catalog row {rid!r}: status {row['status']!r} is not one of {' or '.join(repr(s) for s in STATUSES)} (lower case, no other value)")
    if row["status"] == "active":
        return _entry(row, "provider", provider.split(":", 1)[0] or "stub", _fill(T_PROVIDER, provider=provider))
    if rid in RUNTIME:
        return _entry(row, "missing", None, _fill(T_RUNTIME))
    if rid in BAKE_GROUP and f.catalog is None:
        return _entry(row, "missing", None, _fill(T_NOT_BAKED))
    if rid == "network" and f.cases is None:
        return _entry(row, "missing", None, _fill(T_ABSENT))
    if rid == "network" and f.networks_missing:
        return _entry(row, "partial", "real", _fill(T_NETWORKS, n=len(f.networks_missing), total=f.networks_total), f.networks_missing)
    if rid in MODEL_FILES and f.manifest is not None:
        listed, absent = f.models(MODEL_FILES[rid])
        if absent:
            return _entry(row, "partial", "real", _fill(T_MODELS, n=len(absent), total=len(listed)), absent)
    if rid in STALE_ROWS and f.engine_version != ENGINE_VERSION:
        return _entry(row, "stale", "real", _fill(T_STALE, engine_version=f.engine_version or "unknown", version=ENGINE_VERSION))
    if rid in DOCUMENT and not (f.data / DOCUMENT[rid]).is_file():
        return _entry(row, "missing", None, _fill(T_ABSENT))
    if rid == "branch-table" and not list((f.data / "artifacts" / "csv").glob("*.csv")):
        return _entry(row, "missing", None, _fill(T_ABSENT))
    return _entry(row, "available", "real", None)


def _document(version, raw, entries):
    return {"schema": SCHEMA, "product_version": version, "catalog_sha256": hashlib.sha256(raw).hexdigest(), "contracts": entries}


def compute(*, repo_root, catalog_path=None, version=None):
    """The readiness document of the repository at ``repo_root``. ``catalog_path`` and ``version`` default to the repository's."""
    root = Path(repo_root)
    catalog = Path(catalog_path) if catalog_path else root / CATALOG_REL
    raw = catalog.read_bytes().replace(b"\r\n", b"\n")
    ver = version if version is not None else (root / "VERSION").read_text(encoding="utf-8").strip()
    facts = _Facts(root)
    rows = [r for r in parse_catalog(raw.decode("utf-8")) if r["id"] != "readiness"]
    return _document(ver, raw, [_rule(r, facts, ver) for r in rows])


def provider_document(catalog_text):
    """The provider tree's document: every row served by its provider (the walking skeleton), bound to no real build."""
    raw = catalog_text.replace("\r\n", "\n").encode("utf-8")
    entries = []
    for row in parse_catalog(catalog_text):
        if row["id"] == "readiness":
            continue
        kind, _, path = row["provider"].replace("`", "").partition(":")
        entry = _entry({**row, "status": "active"}, "provider", kind or "stub", _fill(T_PROVIDER, provider=row["provider"].replace("`", "")))
        entries.append(entry)
    doc = _document(PROVIDER_VERSION, raw, entries)
    doc["catalog_sha256"] = "0" * 64
    return doc


def encode(doc):
    """Compact UTF-8 JSON, LF, no BOM, no trailing newline: the bytes scripts/check_readiness.py compares."""
    return json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def write(path, doc):
    """Write ``path`` atomically; return its byte size."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = encode(doc)
    with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent, prefix=".aerovia-", suffix=".tmp", delete=False) as handle:
        handle.write(data)
        temporary = Path(handle.name)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return len(data)

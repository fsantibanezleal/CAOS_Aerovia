"""Generate the provider tree docs/contracts/fixtures/ and the examples docs/contracts/examples/ (catalog section Providers).

The tree follows the layout of ``data/``: one network (``room-pillar``), its catalog, reference checks, science, manifests,
registry, parity fixtures, browser evidence and branch table, taken from the committed documents and pruned to that network,
with every identity (digests, sizes, counts) recomputed; one tiny ONNX model and its checkpoint, built here without torch;
and a readiness document that says ``provider``. Every document is written through ``write_json`` with its schema, so a
fixture that departs from a contract is never written.

Usage: python tests/contracts/make_fixtures.py [--output DIR] [--no-transport]
``--output`` defaults to docs/contracts (fixtures/ and examples/ inside it); the transport examples run the repository's
own TypeScript engine (``npm --prefix frontend run transport``) and are skipped with --no-transport or without node_modules.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pickle
import shutil
import subprocess
import sys
import zipfile
from collections import OrderedDict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "data-pipeline"))

import pt_reader  # noqa: E402
import support as sp  # noqa: E402
from aerovia_pipeline import readiness  # noqa: E402
from aerovia_pipeline.io import digest, write_json  # noqa: E402
from aerovia_pipeline.model import solve  # noqa: E402

NETWORK = "room-pillar"
METHOD = "topology-mlp"
OPTIONS = {"speed": 1, "resistanceScale": 1, "overrides": {}}
SAVED_AT = "2026-10-20T00:00:00.000Z"


def identity(path: Path) -> dict:
    raw = path.read_bytes()
    return {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}


def load(rel: str):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


# ---- a torch checkpoint without torch (the zip format torch.save writes; read back by pt_reader and by torch.load)
class _Global:
    def __init__(self, module: str, name: str) -> None:
        self.module, self.name = module, name

    def __call__(self, *a):  # pragma: no cover - only to satisfy pickle's callable check
        raise TypeError


class _Storage:
    def __init__(self, key: str, numel: int) -> None:
        self.key, self.numel = key, numel


class _Tensor:
    def __init__(self, key: str, shape: list[int]) -> None:
        self.key, self.shape = key, shape

    def __reduce__(self):
        numel = 1
        for n in self.shape:
            numel *= n
        stride, acc = [], 1
        for n in reversed(self.shape):
            stride.append(acc)
            acc *= n
        return (_Global("torch._utils", "_rebuild_tensor_v2"), (_Storage(self.key, numel), 0, tuple(self.shape), tuple(reversed(stride)), False, OrderedDict()))


class _Pickler(pickle._Pickler):  # the pure-Python pickler, so a torch global can be written without importing torch
    def save(self, obj, save_persistent_id=True):
        if isinstance(obj, _Global):
            self.write(pickle.GLOBAL + f"{obj.module}\n{obj.name}\n".encode("ascii"))
            self.memoize(obj)
            return
        super().save(obj, save_persistent_id)

    def persistent_id(self, obj):
        if isinstance(obj, _Storage):
            return ("storage", _Global("torch", "FloatStorage"), obj.key, "cpu", obj.numel)
        return None


def write_checkpoint(path: Path, meta: dict, tensors: dict[str, list[int]]) -> None:
    keys = {name: str(i) for i, name in enumerate(tensors)}
    value = {**{k: v for k, v in meta.items() if k != "stateDict"}, "stateDict": OrderedDict((n, _Tensor(keys[n], s)) for n, s in tensors.items())}
    import io
    buffer = io.BytesIO()
    _Pickler(buffer, protocol=2).dump(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as archive:
        def put(name: str, data: bytes) -> None:
            archive.writestr(zipfile.ZipInfo(f"archive/{name}", date_time=(1980, 1, 1, 0, 0, 0)), data)
        put("data.pkl", buffer.getvalue())
        for name, shape in tensors.items():
            numel = 1
            for n in shape:
                numel *= n
            put(f"data/{keys[name]}", b"\x00" * (4 * numel))
        put("byteorder", b"little")
        put("version", b"3\n")


# ---- a tiny ONNX model with the io of the registry entry
def write_onnx(path: Path, edges: int, nodes: int) -> None:
    import onnx
    from onnx import TensorProto, helper
    f = TensorProto.FLOAT
    weights = helper.make_tensor("pressureWeights", f, [edges, nodes], b"\x00" * (4 * edges * nodes), raw=True)
    graph = helper.make_graph(
        [helper.make_node("Identity", ["logResistanceRatios"], ["rawFlows"]), helper.make_node("Identity", ["logResistanceRatios"], ["flows"]),
         helper.make_node("MatMul", ["logResistanceRatios", "pressureWeights"], ["pressures"])],
        "aerovia-fixture", [helper.make_tensor_value_info("logResistanceRatios", f, ["batch", edges])],
        [helper.make_tensor_value_info("rawFlows", f, ["batch", edges]), helper.make_tensor_value_info("flows", f, ["batch", edges]),
         helper.make_tensor_value_info("pressures", f, ["batch", nodes])], initializer=[weights])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)], producer_name="aerovia-contract-fixture")
    model.ir_version = 8
    model.doc_string = "Aerovia contract fixture: identity flows and zero pressures; a provider, not a learned model."
    onnx.checker.check_model(model)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(model.SerializeToString())


def build(out: Path, transport: bool) -> None:
    fixtures, examples = out / "fixtures", out / "examples"
    if fixtures.exists():
        shutil.rmtree(fixtures)
    data = fixtures / "data"
    net = next(n for n in load("data/cases.json") if n["id"] == NETWORK)
    edges, nodes = len(net["edges"]), len(net["nodes"])
    source = digest([net])

    write_json(data / "cases.json", [net], schema="network")

    # catalog
    catalog = load("data/artifacts/catalog.json")
    case = next(c for c in catalog["cases"] if c["network"]["id"] == NETWORK)
    bench = catalog["benchmark"]
    bench.update({"caseCount": 1, "nodeCount": nodes, "edgeCount": edges, "referenceElapsedMs": case["result"]["elapsedMs"], "maxMassResidual": case["result"]["massResidual"],
                  "maxPressureResidual": case["result"]["pressureResidual"], "samplesPerCase": case["ensemble"]["samples"], "ensembleSamples": case["ensemble"]["samples"],
                  "ensembleElapsedMs": case["ensemble"]["elapsedMs"], "ensembleFailures": case["ensemble"]["failures"], "parityMaxAbsFlow": case["ensemble"]["parityMaxAbsFlow"]})
    catalog["cases"], catalog["sourceSha256"] = [case], source

    checks = load("data/artifacts/reference-checks.json")
    checks["fixtures"] = [f for f in checks["fixtures"] if f["networkId"] == NETWORK]
    bench["paritySamples"] = len(checks["fixtures"])
    write_json(data / "artifacts" / "catalog.json", catalog, schema="catalog")
    write_json(data / "artifacts" / "reference-checks.json", checks, schema="reference-checks")

    (data / "artifacts" / "csv").mkdir(parents=True)
    shutil.copy(ROOT / "data" / "artifacts" / "csv" / f"{NETWORK}.csv", data / "artifacts" / "csv" / f"{NETWORK}.csv")

    # the tiny model, its checkpoint, the registry entry and the parity fixture
    registry = load("data/models/registry.json")
    entry = next(e for e in registry["entries"] if e["methodId"] == METHOD and e["networkId"] == NETWORK)
    models = data / "models"
    write_onnx(models / METHOD / f"{NETWORK}.onnx", edges, nodes)
    real = pt_reader.read_checkpoint(ROOT / "data" / "models" / entry["checkpoint"]["file"])
    write_checkpoint(models / entry["checkpoint"]["file"], {**real, "caseIds": [NETWORK]},
                     {"network.0.weight": [4, edges], "network.0.bias": [4], "network.2.weight": [edges, 4], "network.2.bias": [edges]})
    entry["checkpoint"].update(identity(models / entry["checkpoint"]["file"]))
    entry["onnx"].update(identity(models / entry["onnx"]["file"]))
    entry["sourceSha256"] = source
    entry["onnxParity"].update({"samples": 2, "rawFlowMaxAbs": 0.0, "flowMaxAbs": 0.0, "pressureMaxAbs": 0.0})
    registry["entries"], registry["diagnosticCheckpoints"], registry["sourceSha256"] = [entry], [], source

    import numpy as np
    sample = np.random.default_rng(20261020).normal(0.0, 0.1, (2, edges)).astype(np.float32)
    rows = [[float(x) for x in r] for r in sample]
    parity_doc = load("data/models/parity-fixtures.json")
    parity_doc["fixtures"] = [{"methodId": METHOD, "networkId": NETWORK, "input": rows, "rawFlows": rows, "flows": rows, "pressures": [[0.0] * nodes, [0.0] * nodes]}]
    write_json(models / "registry.json", registry, schema="model-registry")
    write_json(models / "parity-fixtures.json", parity_doc, schema="onnx-parity")

    # browser evidence, then the science that points at it
    evidence = load("data/models/browser-evidence.json")
    evidence["rows"] = [dict(r, modelSha256=entry["onnx"]["sha256"], sample=i, rawFlowMaxAbs=0.0, flowMaxAbs=0.0, pressureMaxAbs=0.0)
                        for i, r in enumerate([r for r in evidence["rows"] if r["networkId"] == NETWORK and r["methodId"] == METHOD][:2])]
    evidence["controls"] = [c for c in evidence["controls"] if c["networkId"] == NETWORK and c["methodId"] == METHOD]
    evidence.update({"sourceSha256": source, "modelCount": 1, "maxFlowAbs": 0.0, "maxPressureAbs": 0.0})
    write_json(models / "browser-evidence.json", evidence, schema="browser-evidence")

    science = load("data/artifacts/science.json")
    science["sourceSha256"] = source
    science["cases"] = [c for c in science["cases"] if c["networkId"] == NETWORK]
    science["heldoutFixtures"] = [f for f in science["heldoutFixtures"] if f["networkId"] == NETWORK]
    b = science["benchmark"]
    for key in ("rows", "calibration", "teacherParity", "degradationRows"):
        b[key] = [r for r in b[key] if r["networkId"] == NETWORK]
    b["familyHoldout"]["metrics"] = [r for r in b["familyHoldout"]["metrics"] if r["networkId"] == NETWORK] or b["familyHoldout"]["metrics"][:1]
    b["completeness"].update({"cases": 1, "expectedCells": 18, "actualCells": len(b["rows"]), "missingCells": 18 - len(b["rows"])})
    science["validation"]["onnx"] = [r for r in science["validation"]["onnx"] if r["networkId"] == NETWORK]
    science["validation"]["controls"] = [r for r in science["validation"]["controls"] if r["networkId"] == NETWORK]
    science["validation"]["browserEvidence"] = {"file": "data/models/browser-evidence.json", **identity(models / "browser-evidence.json"), "models": 1,
                                                  "samples": len(evidence["rows"]), "maxFlowAbs": 0.0, "maxPressureAbs": 0.0}
    write_json(data / "artifacts" / "science.json", science, schema="science")

    # manifests
    artifacts = data / "artifacts"
    files = {p.relative_to(artifacts).as_posix(): identity(p) for p in sorted(artifacts.rglob("*")) if p.is_file()}
    write_json(artifacts / "manifest.json", {"schema": "aerovia.manifest/v1", "createdAt": catalog["createdAt"], "files": files, "engineVersion": bench["engineVersion"],
                                             "sourceSha256": source, "device": bench.get("device", "cpu"), "caseCount": 1}, schema="artifact-manifest")
    mfiles = {p.relative_to(models).as_posix(): identity(p) for p in sorted(models.rglob("*")) if p.is_file() and p.name != "manifest.json"}
    write_json(models / "manifest.json", {"schema": "aerovia.model-manifest/v1", "sourceSha256": source, "files": mfiles}, schema="model-manifest")

    # readiness: every row served by its provider
    text = (ROOT / "docs" / "contracts" / "catalog.md").read_text(encoding="utf-8")
    (data / "readiness.json").write_bytes(readiness.encode(readiness.provider_document(text)))

    # examples
    examples.mkdir(parents=True, exist_ok=True)
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    request = {"id": 1, "kind": "solve", "network": net, "options": OPTIONS}
    result = solve(net, OPTIONS)
    write_json(examples / "engine-worker-request.json", request, schema="engine-worker")
    write_json(examples / "engine-worker-response.json", {"id": 1, "kind": "solve", "result": result}, schema="engine-worker")
    project = {"schema": "aerovia.project/v1", "network": net, "options": OPTIONS, "savedAt": SAVED_AT}
    write_json(examples / "project.json", project, schema="project")
    write_json(examples / "release-identity.json", {"version": version, "commit": "0" * 40, "workingTreeDirty": False,
                                                       "catalogSha256": identity(artifacts / "catalog.json")["sha256"], "scienceSha256": identity(artifacts / "science.json")["sha256"]},
               schema="release-identity")
    _, rows0 = sp.read_csv(artifacts / "csv" / f"{NETWORK}.csv")
    from test_branch_table import typed
    write_json(examples / "branch-table-row.json", typed(rows0[0]), schema="branch-table")
    write_json(examples / "model-io.json", sp.onnx_io(models / METHOD / f"{NETWORK}.onnx"), schema="model-io")
    write_json(examples / "checkpoint.json", pt_reader.read_checkpoint(models / entry["checkpoint"]["file"]), schema="checkpoint")
    if transport:
        make_transport(examples, net, version)


def make_transport(examples: Path, net: dict, version: str) -> None:
    frontend = ROOT / "frontend"
    if not (frontend / "node_modules").is_dir():
        print("transport examples skipped: frontend/node_modules is absent (npm ci)")
        return
    work = examples.parent / ".transport-work"
    work.mkdir(exist_ok=True)
    try:
        edge = next(e for e in net["edges"] if e["kind"] == "working")["id"]
        request = {"durationSeconds": 120, "frameCount": 4, "cellsPerEdge": 2,
                   "releases": [{"kind": "pulse", "edgeId": edge, "startSeconds": 0, "massMg": 1000}]}
        (work / "project.json").write_text(json.dumps({"network": net, "options": OPTIONS}), encoding="utf-8")
        (work / "request.json").write_text(json.dumps(request), encoding="utf-8")
        npm = shutil.which("npm") or "npm"
        subprocess.run([npm, "--prefix", str(frontend), "run", "transport", "--", "--input", str(work / "project.json"), "--request", str(work / "request.json"),
                        "--output", str(work / "out.json")], check=True, capture_output=True, text=True)
        batch = json.loads((work / "out.json").read_text(encoding="utf-8"))
    finally:
        shutil.rmtree(work, ignore_errors=True)
    write_json(examples / "transport-request.json", {"network": net, "options": OPTIONS, "request": batch["request"]}, schema="transport")
    write_json(examples / "transport-response.json", {"result": batch["result"]}, schema="transport")
    write_json(examples / "transport-replay.json", {"schema": "aerovia.transport-replay/v1", "version": version, "network": net, "options": OPTIONS,
                                                       "request": batch["request"], "result": batch["result"]}, schema="transport")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--output", type=Path, default=ROOT / "docs" / "contracts")
    parser.add_argument("--no-transport", action="store_true")
    args = parser.parse_args(argv)
    build(args.output, not args.no_transport)
    print(f"fixtures written under {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

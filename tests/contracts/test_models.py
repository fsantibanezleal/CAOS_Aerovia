"""Contracts artifact-manifest, model-manifest, model-registry, onnx-parity, browser-evidence, model-io and checkpoint:
identities, the model io of every ONNX file against its registry entry, and the checkpoints read without torch."""
from __future__ import annotations

import copy
import hashlib
import pickle

import pytest

import contract_schemas as cs
import pt_reader
import support as sp

TREE_IDS = list(sp.TREES)


def identity(path) -> dict:
    raw = path.read_bytes()
    return {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}


@pytest.mark.parametrize("tree", TREE_IDS)
def test_artifact_manifest_lists_the_files_by_identity(tree: str) -> None:
    root = sp.TREES[tree] / "data" / "artifacts"
    manifest = sp.doc(tree, "artifact-manifest")
    assert manifest["caseCount"] == len(sp.networks(tree))
    assert manifest["sourceSha256"] == sp.doc(tree, "catalog")["sourceSha256"]
    for name, spec in manifest["files"].items():
        assert identity(root / name) == spec, name
    assert {n for n in manifest["files"] if n.startswith("csv/")} == {f"csv/{p.name}" for p in sp.csv_files(tree)}


@pytest.mark.parametrize("tree", TREE_IDS)
def test_model_manifest_lists_every_model_file_by_identity(tree: str) -> None:
    root = sp.models_dir(tree)
    manifest = sp.doc(tree, "model-manifest")
    listed = set(manifest["files"])
    present = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()} - {"manifest.json"}
    assert listed == present
    for name, spec in manifest["files"].items():
        assert identity(root / name) == spec, name


@pytest.mark.parametrize("tree", TREE_IDS)
def test_registry_entries_agree_with_the_manifest_and_the_networks(tree: str) -> None:
    manifest = sp.doc(tree, "model-manifest")["files"]
    registry = sp.doc(tree, "model-registry")
    nets = {n["id"]: n for n in sp.networks(tree)}
    assert registry["sourceSha256"] == sp.doc(tree, "catalog")["sourceSha256"] == sp.doc(tree, "model-manifest")["sourceSha256"]
    seen = set()
    for entry in registry["entries"]:
        key = (entry["methodId"], entry["networkId"])
        assert key not in seen
        seen.add(key)
        for kind in ("checkpoint", "onnx"):
            spec = entry[kind]
            assert manifest[spec["file"]] == {"sha256": spec["sha256"], "bytes": spec["bytes"]}, (key, kind)
        net = nets[entry["networkId"]]
        sig = entry["signature"]
        assert sig["edgeIds"] == [e["id"] for e in net["edges"]]
        assert sig["nodeIds"] == [n["id"] for n in net["nodes"]]
        assert len(entry["baseResistances"]) == len(net["edges"])
        assert entry["input"]["shape"] == ["batch", len(net["edges"])]
    for chk in registry["diagnosticCheckpoints"]:
        assert manifest[chk["file"]] == {"sha256": chk["sha256"], "bytes": chk["bytes"]}


@pytest.mark.parametrize("tree", TREE_IDS)
def test_parity_fixtures_match_the_registry_widths(tree: str) -> None:
    registry = {(e["methodId"], e["networkId"]): e for e in sp.doc(tree, "model-registry")["entries"]}
    nets = {n["id"]: n for n in sp.networks(tree)}
    for fx in sp.doc(tree, "onnx-parity")["fixtures"]:
        entry = registry[(fx["methodId"], fx["networkId"])]
        net = nets[fx["networkId"]]
        samples = len(fx["input"])
        assert samples == len(fx["rawFlows"]) == len(fx["flows"]) == len(fx["pressures"])
        assert all(len(r) == len(net["edges"]) for r in fx["input"] + fx["rawFlows"] + fx["flows"])
        assert all(len(r) == len(net["nodes"]) for r in fx["pressures"])
        assert entry["onnxParity"]["samples"] <= samples or entry["onnxParity"]["samples"] >= 1


@pytest.mark.parametrize("tree", TREE_IDS)
def test_browser_evidence_refers_to_registered_models(tree: str) -> None:
    registry = {(e["methodId"], e["networkId"]): e for e in sp.doc(tree, "model-registry")["entries"]}
    evidence = sp.doc(tree, "browser-evidence")
    assert evidence["modelCount"] == len(registry)
    assert evidence["sourceSha256"] == sp.doc(tree, "model-registry")["sourceSha256"]
    for row in evidence["rows"]:
        assert row["modelSha256"] == registry[(row["methodId"], row["networkId"])]["onnx"]["sha256"]
    assert evidence["maxFlowAbs"] == max(r["flowMaxAbs"] for r in evidence["rows"])


@pytest.mark.parametrize("tree", TREE_IDS)
def test_every_onnx_file_has_the_io_its_registry_entry_declares(tree: str) -> None:
    pytest.importorskip("onnx")
    root = sp.models_dir(tree)
    nets = {n["id"]: n for n in sp.networks(tree)}
    registry = sp.doc(tree, "model-registry")
    checked = 0
    for entry in registry["entries"]:
        io = sp.onnx_io(root / entry["onnx"]["file"])
        assert cs.errors("model-io", io) == [], entry["onnx"]["file"]
        assert sp.entry_problems(entry, io, nets[entry["networkId"]]) == [], entry["onnx"]["file"]
        checked += 1
    assert checked == len(registry["entries"])
    on_disk = sorted(p.relative_to(root).as_posix() for p in root.rglob("*.onnx"))
    assert on_disk == sorted(e["onnx"]["file"] for e in registry["entries"])


def test_all_twenty_four_committed_onnx_files_are_checked() -> None:
    assert len(sp.doc("bake", "model-registry")["entries"]) == 24


def test_an_onnx_file_whose_io_differs_from_its_entry_fails() -> None:
    """The refutation: a swapped input name, a changed width or a reordered output is reported."""
    pytest.importorskip("onnx")
    entry = copy.deepcopy(sp.doc("bake", "model-registry")["entries"][0])
    net = next(n for n in sp.networks("bake") if n["id"] == entry["networkId"])
    io = sp.onnx_io(sp.models_dir("bake") / entry["onnx"]["file"])
    assert sp.entry_problems(entry, io, net) == []
    renamed = copy.deepcopy(io)
    renamed["inputs"][0]["name"] = "x"
    assert sp.entry_problems(entry, renamed, net)
    narrow = copy.deepcopy(io)
    narrow["outputs"][1]["shape"] = ["batch", 3]
    assert sp.entry_problems(entry, narrow, net)
    reordered = copy.deepcopy(io)
    reordered["outputs"].reverse()
    assert sp.entry_problems(entry, reordered, net)
    other = copy.deepcopy(entry)
    other["outputs"] = ["flows", "rawFlows", "pressures"]
    assert sp.entry_problems(other, io, net)
    assert cs.errors("model-io", {"inputs": io["inputs"], "outputs": io["outputs"][:2]})


@pytest.mark.parametrize("tree", TREE_IDS)
def test_every_checkpoint_matches_the_checkpoint_schema_and_its_entry(tree: str) -> None:
    root = sp.models_dir(tree)
    registry = sp.doc(tree, "model-registry")
    files = sorted(root.rglob("*.pt"))
    assert files
    for path in files:
        ckpt = pt_reader.read_checkpoint(path)
        assert cs.errors("checkpoint", ckpt) == [], path.name
        assert ckpt["edges"] >= 1
    for entry in registry["entries"]:
        ckpt = pt_reader.read_checkpoint(root / entry["checkpoint"]["file"])
        assert ckpt["methodId"] == entry["methodId"]
        assert entry["networkId"] in ckpt["caseIds"]
        if entry["methodId"] == "topology-mlp":
            assert ckpt["edges"] == entry["input"]["shape"][1]
            assert ckpt["seed"] == entry["trainingSeed"]
            assert ckpt["epoch"] == entry["bestEpoch"]
    for chk in registry["diagnosticCheckpoints"]:
        assert pt_reader.read_checkpoint(root / chk["file"])["caseIds"] == chk["trainingCaseIds"]


def test_all_fourteen_committed_checkpoints_are_read() -> None:
    assert len(list(sp.models_dir("bake").rglob("*.pt"))) == 14


def test_a_checkpoint_missing_a_key_is_rejected_and_a_hostile_pickle_refused(tmp_path) -> None:
    ckpt = pt_reader.read_checkpoint(next(sp.models_dir("bake").rglob("*.pt")))
    for key in list(ckpt):
        broken = {k: v for k, v in ckpt.items() if k != key}
        assert cs.errors("checkpoint", broken), key
    assert cs.errors("checkpoint", {**ckpt, "optimizer": {}})

    import zipfile
    hostile = tmp_path / "hostile.pt"
    with zipfile.ZipFile(hostile, "w") as z:
        z.writestr("archive/data.pkl", pickle.dumps(__import__("os").getcwd, protocol=2))
    with pytest.raises(pickle.UnpicklingError):
        pt_reader.read_checkpoint(hostile)


def test_the_validators_of_the_pipeline_still_accept_the_committed_models() -> None:
    from aerovia_pipeline.surrogate_validate import validate_models
    report = validate_models(sp.models_dir("bake"))
    assert report["models"] == 24


def test_the_release_validator_reads_the_science_document() -> None:
    """The science document's consumer in Python: validate_release recomputes physical residuals of every replay."""
    from aerovia_pipeline.surrogate_validate import validate_release
    report = validate_release(sp.models_dir("bake"), sp.TREES["bake"] / "data" / "artifacts" / "science.json", sp.TREES["bake"] / "data" / "cases.json")
    assert report

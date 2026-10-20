"""Shared helpers of the contract tests: the two trees the swap tests run on, the documents of each row, the catalog
parser and the ONNX reader (no torch, no onnxruntime)."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

import contract_schemas as cs

ROOT = cs.ROOT
CATALOG = cs.CONTRACTS / "catalog.md"
# the swap: every committed-document test runs on the real data/ and on the provider tree with the same assertions
TREES = {"bake": ROOT, "fixture": cs.FIXTURE_ROOT}

# row -> (schema name, document path relative to a tree root); the one-file rows
FILES = {
    "network": ("network", "data/cases.json"),
    "catalog": ("catalog", "data/artifacts/catalog.json"),
    "reference-checks": ("reference-checks", "data/artifacts/reference-checks.json"),
    "science": ("science", "data/artifacts/science.json"),
    "artifact-manifest": ("artifact-manifest", "data/artifacts/manifest.json"),
    "browser-evidence": ("browser-evidence", "data/models/browser-evidence.json"),
    "model-manifest": ("model-manifest", "data/models/manifest.json"),
    "model-registry": ("model-registry", "data/models/registry.json"),
    "onnx-parity": ("onnx-parity", "data/models/parity-fixtures.json"),
    "readiness": ("readiness", "data/readiness.json"),
}


def doc(tree: str, row: str) -> Any:
    return cs.load_json(TREES[tree] / FILES[row][1])


def networks(tree: str) -> list[dict]:
    return doc(tree, "network")


def models_dir(tree: str) -> Path:
    return TREES[tree] / "data" / "models"


def csv_files(tree: str) -> list[Path]:
    return sorted((TREES[tree] / "data" / "artifacts" / "csv").glob("*.csv"))


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        return list(reader.fieldnames or []), rows


def catalog_rows() -> list[dict[str, str]]:
    from check_contracts import parse_catalog
    parsed = parse_catalog(CATALOG.read_text(encoding="utf-8"))
    assert parsed is not None, "docs/contracts/catalog.md has no contract table"
    return parsed[1]


def onnx_io(path: Path) -> dict[str, list[dict]]:
    """The input and output tensors of an ONNX file as ``{"inputs": [...], "outputs": [...]}``; a symbolic dimension is ``"batch"``."""
    import onnx
    graph = onnx.load(str(path)).graph
    names = {1: "float32", 7: "int64", 11: "float64"}

    def tensors(values) -> list[dict]:
        out = []
        for v in values:
            t = v.type.tensor_type
            shape = [d.dim_param and "batch" or d.dim_value for d in t.shape.dim]
            out.append({"name": v.name, "dtype": names.get(t.elem_type, str(t.elem_type)), "shape": shape})
        return out

    return {"inputs": tensors(graph.input), "outputs": tensors(graph.output)}


def entry_problems(entry: dict, io: dict, network: dict) -> list[str]:
    """How an ONNX file departs from its registry entry and network: names, dtype, order and widths. Empty when it agrees."""
    problems: list[str] = []
    edges, nodes = len(network["edges"]), len(network["nodes"])
    declared = entry["input"]
    if [t["name"] for t in io["inputs"]] != [declared["name"]]:
        problems.append(f"input names {[t['name'] for t in io['inputs']]} != {declared['name']}")
    elif io["inputs"][0]["dtype"] != declared["dtype"] or io["inputs"][0]["shape"] != declared["shape"]:
        problems.append(f"input {io['inputs'][0]} != declared {declared}")
    if declared["shape"] != ["batch", edges]:
        problems.append(f"declared input shape {declared['shape']} is not [batch, {edges}] for {network['id']}")
    if [t["name"] for t in io["outputs"]] != entry["outputs"]:
        problems.append(f"output names {[t['name'] for t in io['outputs']]} != {entry['outputs']}")
    else:
        widths = {"rawFlows": edges, "flows": edges, "pressures": nodes}
        for tensor in io["outputs"]:
            if tensor["shape"] != ["batch", widths[tensor["name"]]] or tensor["dtype"] != "float32":
                problems.append(f"output {tensor} != [batch, {widths[tensor['name']]}] float32")
    return problems

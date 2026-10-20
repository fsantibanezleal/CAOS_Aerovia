"""Every committed document against its schema file, on the real data/ and on the provider tree (the swap tests), and the
refutations: a schema must reject a document that lacks a field every document carries or carries an unknown one."""
from __future__ import annotations

import copy
import json

import pytest

import contract_schemas as cs
import support as sp

ONE_FILE = [r for r in sp.FILES if r != "readiness"]
TREE_IDS = list(sp.TREES)


def required_keys(row: str) -> list[str]:
    schema = cs.load_json(cs.SCHEMAS / f"{sp.FILES[row][0]}.schema.json")
    if row == "network":
        return schema["$defs"]["network"]["required"]
    return schema["required"]


@pytest.mark.parametrize("tree", TREE_IDS)
@pytest.mark.parametrize("row", ONE_FILE)
def test_document_validates(tree: str, row: str) -> None:
    assert cs.errors(sp.FILES[row][0], sp.doc(tree, row)) == []


def test_all_twelve_committed_networks_validate() -> None:
    nets = sp.networks("bake")
    assert len(nets) == 12
    for net in nets:
        assert cs.def_errors("network", "network", net) == [], net["id"]


def test_the_fixture_tree_has_a_network_and_a_catalog_of_it() -> None:
    nets = sp.networks("fixture")
    assert len(nets) == 1
    assert [c["network"]["id"] for c in sp.doc("fixture", "catalog")["cases"]] == [nets[0]["id"]]


@pytest.mark.parametrize("tree", TREE_IDS)
@pytest.mark.parametrize("row", ONE_FILE)
def test_a_document_missing_a_required_field_is_rejected(tree: str, row: str) -> None:
    for key in required_keys(row):
        broken = copy.deepcopy(sp.doc(tree, row))
        target = broken[0] if row == "network" else broken
        del target[key]
        assert cs.errors(sp.FILES[row][0], broken), f"{row}: removing {key} was accepted"


@pytest.mark.parametrize("row", ONE_FILE)
def test_a_document_with_an_unknown_field_is_rejected(row: str) -> None:
    broken = copy.deepcopy(sp.doc("bake", row))
    target = broken[0] if row == "network" else broken
    target["unexpected"] = 1
    assert cs.errors(sp.FILES[row][0], broken)


def test_nested_depth_is_checked() -> None:
    """Fields below the top level are part of the contract: nodes, edges, results, ensembles, registry entries."""
    cases = {
        "network": lambda d: d[0]["edges"][0].pop("area"),
        "catalog": lambda d: d["cases"][0]["result"].pop("flows"),
        "catalog#ensemble": lambda d: d["cases"][0]["ensemble"].pop("flowP95"),
        "reference-checks": lambda d: d["fixtures"][0]["result"].pop("pressures"),
        "science": lambda d: d["cases"][0]["regimes"][0]["predictions"]["topology-mlp"].pop("rawFlows"),
        "model-registry": lambda d: d["entries"][0]["onnx"].pop("sha256"),
        "onnx-parity": lambda d: d["fixtures"][0].pop("pressures"),
        "browser-evidence": lambda d: d["rows"][0].pop("modelSha256"),
    }
    for label, mutate in cases.items():
        row = label.split("#")[0]
        broken = copy.deepcopy(sp.doc("bake", row))
        mutate(broken)
        assert cs.errors(sp.FILES[row][0], broken), label


def test_a_fan_branch_needs_its_fan_curve_and_no_other_does() -> None:
    net = copy.deepcopy(sp.networks("bake")[0])
    fan = next(e for e in net["edges"] if e["kind"] == "fan")
    plain = next(e for e in net["edges"] if e["kind"] != "fan")
    assert cs.def_errors("network", "network", net) == []
    saved = fan.pop("fan")
    assert cs.def_errors("network", "network", net)
    fan["fan"] = saved
    plain["fan"] = dict(saved)
    assert cs.def_errors("network", "network", net)


def test_every_schema_file_is_a_valid_2020_12_schema_with_an_id() -> None:
    files = sorted(cs.SCHEMAS.glob("*.schema.json"))
    assert len(files) == 17
    for f in files:
        schema = cs.load_json(f)
        assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
        assert schema["$id"] == f.name
        cs.validator(f.name[: -len(".schema.json")])


def test_documents_are_utf8_without_bom_and_lf() -> None:
    for tree in TREE_IDS:
        for row in ONE_FILE:
            raw = (sp.TREES[tree] / sp.FILES[row][1]).read_bytes()
            assert not raw.startswith(b"\xef\xbb\xbf"), (tree, row)
            assert b"\r\n" not in raw, (tree, row)
            json.loads(raw.decode("utf-8"))
    for f in cs.SCHEMAS.glob("*.json"):
        raw = f.read_bytes()
        assert not raw.startswith(b"\xef\xbb\xbf") and b"\r\n" not in raw, f.name

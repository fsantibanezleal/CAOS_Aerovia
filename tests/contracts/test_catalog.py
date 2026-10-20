"""Contracts catalog, reference-checks and science: identities and shapes the schemas cannot state."""
from __future__ import annotations

import pytest

import support as sp
from aerovia_pipeline.io import digest

TREE_IDS = list(sp.TREES)


@pytest.mark.parametrize("tree", TREE_IDS)
def test_catalog_matches_its_networks(tree: str) -> None:
    catalog = sp.doc(tree, "catalog")
    nets = {n["id"]: n for n in sp.networks(tree)}
    assert catalog["sourceSha256"] == digest([c["network"] for c in catalog["cases"]])
    for case in catalog["cases"]:
        net = case["network"]
        assert net == nets[net["id"]]
        assert case["sourceSha256"] == digest(net)
        assert case["optionsSha256"] == digest(case["options"])
        assert len(case["result"]["flows"]) == len(net["edges"])
        assert len(case["result"]["pressures"]) == len(net["nodes"])
        assert len(case["result"]["velocities"]) == len(net["edges"])
        assert len(case["result"]["shortfalls"]) == len(net["edges"])
        if "ensemble" in case:
            e = case["ensemble"]
            for key in ("flowP05", "flowP50", "flowP95", "targetProbability"):
                assert len(e[key]) == len(net["edges"]), key
            assert all(a <= b <= c for a, b, c in zip(e["flowP05"], e["flowP50"], e["flowP95"]))
            assert e["failures"] == 0 and len(e["failedSampleIndices"]) == 0
    assert catalog["benchmark"]["caseCount"] == len(catalog["cases"])


@pytest.mark.parametrize("tree", TREE_IDS)
def test_reference_checks_refer_to_catalog_networks(tree: str) -> None:
    catalog = {c["network"]["id"]: c["network"] for c in sp.doc(tree, "catalog")["cases"]}
    for fx in sp.doc(tree, "reference-checks")["fixtures"]:
        net = catalog[fx["networkId"]]
        assert len(fx["result"]["flows"]) == len(net["edges"])
        assert len(fx["result"]["pressures"]) == len(net["nodes"])
        assert set(fx["options"]["overrides"]) <= {e["id"] for e in net["edges"]}


@pytest.mark.parametrize("tree", TREE_IDS)
def test_science_refers_to_the_same_sources(tree: str) -> None:
    science = sp.doc(tree, "science")
    catalog = sp.doc(tree, "catalog")
    assert science["sourceSha256"] == catalog["sourceSha256"]
    ids = {c["network"]["id"] for c in catalog["cases"]}
    assert {c["networkId"] for c in science["cases"]} == ids
    assert {f["networkId"] for f in science["heldoutFixtures"]} <= ids
    nets = {c["network"]["id"]: c["network"] for c in catalog["cases"]}
    for case in science["cases"]:
        for regime in case["regimes"]:
            assert len(regime["reference"]["flows"]) == len(nets[case["networkId"]]["edges"])

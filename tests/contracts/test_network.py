"""Contract network: the rules the schema cannot state, held to the pipeline's own validator on every network."""
from __future__ import annotations

import copy

import pytest

import contract_schemas as cs
import support as sp
from aerovia_pipeline.model import NetworkError, validate_network

TREE_IDS = list(sp.TREES)


@pytest.mark.parametrize("tree", TREE_IDS)
def test_pipeline_and_schema_agree_on_every_network(tree: str) -> None:
    for net in sp.networks(tree):
        validate_network(net)
        assert cs.def_errors("network", "network", net) == []
        ids = [n["id"] for n in net["nodes"]]
        assert len(ids) == len(set(ids))
        eids = [e["id"] for e in net["edges"]]
        assert len(eids) == len(set(eids))
        assert all(e["from"] in ids and e["to"] in ids and e["from"] != e["to"] for e in net["edges"])
        assert any("boundary" in n for n in net["nodes"])


def test_network_ids_are_unique_across_the_library() -> None:
    ids = [n["id"] for n in sp.networks("bake")]
    assert len(ids) == len(set(ids)) == 12


def test_a_rule_the_schema_states_is_a_rule_the_pipeline_states() -> None:
    """Seven single-field breaks: schema and pipeline both reject each."""
    base = sp.networks("bake")[0]
    mutations = {
        "area too small": lambda n: n["edges"][0].__setitem__("area", 0.01),
        "resistance zero": lambda n: n["edges"][0].__setitem__("resistance", 0),
        "unknown kind": lambda n: n["edges"][0].__setitem__("kind", "shaft"),
        "level out of range": lambda n: n["edges"][0].__setitem__("level", 500),
        "missing spanish name": lambda n: n["name"].pop("es"),
        "bad provenance kind": lambda n: n["provenance"].__setitem__("kind", "invented"),
        "wrong schema string": lambda n: n.__setitem__("schema", "aerovia.network/v2"),
    }
    for label, mutate in mutations.items():
        net = copy.deepcopy(base)
        mutate(net)
        assert cs.def_errors("network", "network", net), f"schema accepted: {label}"
        with pytest.raises(NetworkError):
            validate_network(net)

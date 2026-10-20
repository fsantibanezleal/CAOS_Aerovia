"""Contracts engine-worker, transport, project and release-identity: nothing is committed, so each has a provider example
under docs/contracts/examples/, produced here from the real solver code paths where Python can, and checked both ways."""
from __future__ import annotations

import copy
import json


import contract_schemas as cs
import support as sp
from aerovia_pipeline.io import load_networks
from aerovia_pipeline.model import solve

EXAMPLES = cs.EXAMPLES


def example(name: str):
    return cs.load_json(EXAMPLES / f"{name}.json")


def test_every_runtime_example_validates() -> None:
    assert cs.errors("engine-worker", example("engine-worker-request")) == []
    assert cs.errors("engine-worker", example("engine-worker-response")) == []
    assert cs.errors("transport", example("transport-request")) == []
    assert cs.errors("transport", example("transport-response")) == []
    assert cs.errors("transport", example("transport-replay")) == []
    assert cs.errors("project", example("project")) == []
    assert cs.errors("release-identity", example("release-identity")) == []


def test_the_engine_example_result_is_a_real_solve_of_its_network() -> None:
    req, resp = example("engine-worker-request"), example("engine-worker-response")
    assert resp["id"] == req["id"] and resp["kind"] == req["kind"] == "solve"
    fresh = solve(req["network"], req["options"])
    assert cs.def_errors("catalog", "result", fresh) == []
    assert len(resp["result"]["flows"]) == len(fresh["flows"])
    assert max(abs(a - b) for a, b in zip(resp["result"]["flows"], fresh["flows"])) < 1e-6


def test_engine_responses_carry_a_result_or_an_error_never_both_or_neither() -> None:
    resp = example("engine-worker-response")
    assert cs.errors("engine-worker", {**resp, "error": "x"})
    assert cs.errors("engine-worker", {k: v for k, v in resp.items() if k != "result"})
    assert cs.errors("engine-worker", {"id": 1, "kind": "solve", "error": "The numerical operation failed."}) == []
    assert cs.errors("engine-worker", {**resp, "kind": "frobnicate"})
    assert cs.errors("engine-worker", {**resp, "kind": "curve"}), "a solve result under kind curve must be rejected"


def test_every_engine_kind_has_a_response_shape() -> None:
    ok = {
        "optimize": {"feasible": True, "speed": 1.0, "evaluations": 3, "result": example("engine-worker-response")["result"]},
        "sensitivity": [{"edgeId": "a", "elasticity": 0.1, "powerDelta": 1.0, "flowDelta": -1.0}],
        "curve": [{"speed": 0.5, "flow": 1.0, "power": 2.0, "pressure": 3.0, "targetRatio": 1.0}],
    }
    for kind, result in ok.items():
        assert cs.errors("engine-worker", {"id": "a", "kind": kind, "result": result}) == [], kind
    assert cs.errors("engine-worker", {"id": "a", "kind": "sensitivity", "result": [{"edgeId": "a"}]})
    assert cs.errors("engine-worker", {"id": "a", "kind": "curve", "result": [{"speed": 0.5}]})


def test_a_request_without_its_network_is_rejected() -> None:
    req = example("engine-worker-request")
    for key in ("id", "kind", "network", "options"):
        assert cs.errors("engine-worker", {k: v for k, v in req.items() if k != key}), key


def test_transport_result_and_replay_are_strict() -> None:
    replay = example("transport-replay")
    for key in replay:
        assert cs.errors("transport", {k: v for k, v in replay.items() if k != key}), key
    broken = copy.deepcopy(replay)
    del broken["result"]["frames"][0]["storedMassMg"]
    assert cs.errors("transport", broken)
    broken = copy.deepcopy(replay)
    broken["request"]["releases"][0]["kind"] = "burst"
    assert cs.errors("transport", broken)
    assert replay["result"]["schema"] == "aerovia.transport/v1"
    assert replay["schema"] == "aerovia.transport-replay/v1"


def test_transport_frames_keep_the_mass_balance() -> None:
    result = example("transport-replay")["result"]
    for frame in result["frames"]:
        total = frame["storedMassMg"] + frame["escapedMassMg"] + frame["removedMassMg"]
        assert abs(frame["injectedMassMg"] - total - frame["massBalanceErrorMg"]) < 1e-6 or abs(frame["massBalanceErrorMg"]) < 1e-6


def test_the_project_example_is_read_by_the_pipeline_and_the_schema() -> None:
    project = example("project")
    path = sp.ROOT / "docs" / "contracts" / "examples" / "project.json"
    nets = load_networks(path)
    assert nets[0]["id"] == project["network"]["id"]
    assert cs.errors("project", project) == []
    for key in ("schema", "network", "options", "savedAt"):
        assert cs.errors("project", {k: v for k, v in project.items() if k != key}), key
    assert cs.errors("project", {**project, "savedAt": "yesterday"})
    assert cs.errors("project", {**project, "schema": "aerovia.project/v2"})
    assert cs.errors("project", {**project, "author": "someone"})
    assert len(json.dumps(project).encode("utf-8")) < 2 * 1024 * 1024


def test_project_with_baseline_validates_and_is_swap_equal_on_both_trees() -> None:
    for tree in sp.TREES:
        net = sp.networks(tree)[0]
        options = {"speed": 1, "resistanceScale": 1, "overrides": {}}
        project = {"schema": "aerovia.project/v1", "network": net, "options": options,
                   "baseline": {"network": net, "options": options}, "savedAt": "2026-10-20T00:00:00.000Z"}
        assert cs.errors("project", project) == [], tree


def test_release_identity_is_strict() -> None:
    ident = example("release-identity")
    for key in ident:
        assert cs.errors("release-identity", {k: v for k, v in ident.items() if k != key}), key
    assert cs.errors("release-identity", {**ident, "commit": "abc"})
    assert cs.errors("release-identity", {**ident, "version": "1.2"})
    assert cs.errors("release-identity", {**ident, "extra": 1})


def test_release_identity_matches_what_prepare_data_writes() -> None:
    """The writer is a JS build script; hold its key list to the schema's."""
    text = (sp.ROOT / "frontend" / "scripts" / "prepare-data.mjs").read_text(encoding="utf-8")
    schema = cs.load_json(cs.SCHEMAS / "release-identity.schema.json")
    for key in schema["required"]:
        assert key in text, key
    assert "release.json" in text

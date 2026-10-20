"""Plants for the network-cases feature (NC-001 to NC-006): one planted defect per requirement, in a throwaway copy, and the
requirement's own gate run on the copy.

The gates are the contract tests of ``tests/contracts`` and the model tests of ``tests/python`` (pytest in a subprocess on the
copy), the vitest test of ``frontend/src/engine.test.ts`` (node on a copy that links the real ``node_modules``, local-only)
and the browser journey of ``frontend/e2e/workbench.spec.ts`` (a built copy served on port 4203 and Playwright, local-only).
The contract tests run on two trees (the committed data, ``bake``, and the provider fixtures); a plant is in the committed data,
so the gate that must fail is the ``bake`` case."""
from __future__ import annotations

from pathlib import Path

import pytest
from _engine_tools import WEB_AVAILABLE, browser_plant, edit_json, needs_browser, py_copy, py_plant, web_plant
from planting import edit

FACTORY = pytest.TempPathFactory
NETWORK = "tests/contracts/test_network.py::"
CATALOG = "tests/contracts/test_catalog.py::"
DOCUMENTS = "tests/contracts/test_documents.py::"
MODEL = "tests/python/test_model.py::"


def test_nc_001_a_repeated_identifier_and_a_missing_field_are_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    from _engine_tools import assert_py_clean, assert_py_fails
    gates = [DOCUMENTS + "test_all_twelve_committed_networks_validate", NETWORK + "test_network_ids_are_unique_across_the_library"]
    assert_py_clean(tmp_path_factory, *gates)
    tree = py_copy(tmp_path / "py")

    def plant(nets: list) -> None:
        nets[1]["id"] = nets[0]["id"]  # an identifier repeated
        del nets[2]["edges"][0]["area"]  # a required field removed

    edit_json(tree, "data/cases.json", plant)
    assert_py_fails(tree, *gates)


def test_nc_002_a_rule_stated_on_only_one_side_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    from _engine_tools import assert_py_clean, assert_py_fails
    gates = [NETWORK + "test_pipeline_and_schema_agree_on_every_network[bake]",
             NETWORK + "test_a_rule_the_schema_states_is_a_rule_the_pipeline_states"]
    assert_py_clean(tmp_path_factory, *gates)
    tree = py_copy(tmp_path / "py")

    def self_loop(nets: list) -> None:
        nets[-1]["edges"][0]["to"] = nets[-1]["edges"][0]["from"]  # one airway leaves and enters the same node (the base of the rule test is network 0)

    edit_json(tree, "data/cases.json", self_loop)
    # the schema states the lower bound of the area; the validator of the pipeline stops stating it
    edit(tree, "data-pipeline/aerovia_pipeline/model.py", 'number(edge.get("area"), "area", .1, 1000)', 'number(edge.get("area"), "area", 0, 1000)')
    assert_py_fails(tree, *gates)


def test_nc_003_a_missing_case_and_an_unclosed_case_are_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    from _engine_tools import assert_py_clean, assert_py_fails
    gate = MODEL + "test_all_authored_cases_conserve_mass_and_pressure[return-restriction]"
    assert_py_clean(tmp_path_factory, gate)
    tree = py_copy(tmp_path / "py")
    # a restriction no reference can close: the resistance leaves the supported range of the reference
    edit(tree, "data-pipeline/aerovia_pipeline/cases.py", '["resistance"] *= 8', '["resistance"] *= 1e9')
    assert_py_fails(tree, gate)
    if not WEB_AVAILABLE:
        return  # the browser half is local-only: it needs node and the installed frontend (the checks job has no vitest run here)
    # the browser library loses a case: the twelve-case test of the engine suite fails
    web_plant(tmp_path / "library", tmp_path_factory, "src/engine.test.ts", [], ["includes the complete twelve-case library"],
              mutate=lambda tree: edit_json(tree, "data/cases.json", lambda cases: cases.pop()))


def test_nc_004_a_sealed_case_that_equals_the_open_case_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    py_plant(tmp_path, tmp_path_factory,
             [("data-pipeline/aerovia_pipeline/cases.py", '            e["resistance"] = 18\n',
               '            e["resistance"] = .09 + .02*int(e["id"].split("-")[1])\n')],
             [MODEL + "test_leakage_sealing_improves_every_working_target_ratio"])


def test_nc_005_a_renamed_network_and_a_foreign_reference_check_are_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    from _engine_tools import assert_py_clean, assert_py_fails
    gates = [CATALOG + "test_catalog_matches_its_networks[bake]", CATALOG + "test_reference_checks_refer_to_catalog_networks[bake]"]
    assert_py_clean(tmp_path_factory, *gates)
    tree = py_copy(tmp_path / "py")

    def rename(catalog: dict) -> None:
        catalog["cases"][0]["network"]["id"] = "renamed-network"

    def foreign(checks: dict) -> None:
        checks["fixtures"][0]["networkId"] = "network-not-in-the-catalog"

    edit_json(tree, "data/artifacts/catalog.json", rename)
    edit_json(tree, "data/artifacts/reference-checks.json", foreign)
    assert_py_fails(tree, *gates)


@needs_browser
def test_nc_006_a_case_list_that_omits_a_network_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    browser_plant(tmp_path, tmp_path_factory, "e2e/workbench.spec.ts",
                  "all twelve authored cases remain selectable and solvable through rapid case changes",
                  [("src/workbench/Workbench.tsx", "...w.catalog!.cases.map((c) => ({", "...w.catalog!.cases.slice(0, -1).map((c) => ({")])

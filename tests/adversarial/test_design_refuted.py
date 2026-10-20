"""Adversarial checks of the design feature (drawing, importing and keeping a network): one planted defect per requirement, in
a throwaway copy of the repository, and the requirement's own gate run on the copy.

The gates are the frontend's vitest tests of the editor (``editor.test.ts``), of the table importer (``tableImport.test.ts``)
and of the project storage (``storage.test.ts``), and the browser journey of the project dialog (``workbench.spec.ts``).
A defect is planted in the copy's source, the named tests are run with node on the copy (the real ``node_modules`` is linked
in) and must fail by name, while the same tests pass on the clean copy; DS-011's journey is built, served on port 4204 and
run with Playwright, and skips when there is no Playwright browser. A requirement that lists several gate tests lists each
for a part of its statement: a plant fails the tests of the part it breaks, and the other tests of the row keep passing
(they are the controls of the plant). Nothing here writes into the real tree."""
from __future__ import annotations

from pathlib import Path

import pytest
from _web_tools import (BROWSER_MISSING, BROWSER_REASON, NODE_MISSING, NODE_REASON, _negative_control, _utf8_output, assert_journeys_caught,  # noqa: F401
                        assert_journeys_clean, assert_vitest_caught, assert_vitest_clean, fe, plant, plant_re, web)

needs_node = pytest.mark.skipif(NODE_MISSING, reason=NODE_REASON)
needs_browser = pytest.mark.skipif(BROWSER_MISSING, reason=BROWSER_REASON)

EDITOR_TEST = "src/engine/editor.test.ts"
IMPORT_TEST = "src/engine/tableImport.test.ts"
STORAGE_TEST = "src/storage.test.ts"
EDITOR = fe("src/engine/editor.ts")
IMPORTER = fe("src/engine/tableImport.ts")
STORAGE = fe("src/storage.ts")

DS001 = ["draws, connects and places equipment without mutating the original design"]
DS001_CONTROL = ["operates on deeply frozen inputs without mutating nested network values"]
DS002 = ["rejects invalid transactions and keeps existing data intact",
         "rejects contradictory fan equipment and invalid physical property edits transactionally"]
DS003 = ["splitting conserves total series resistance and places a fan only once"]
DS003_CONTROL = ["does not create sub-minimum geometry or resistance during a split"]
DS004 = ["rejects a coincident or nearly coincident junction move without changing geometry",
         "checks every incident edge when moving a shared junction"]
DS005 = ["rejects identity or connectivity injection through drawing defaults and property edits"]
DS005_CONTROL = ["copies only coordinates when a move caller supplies a complete or forged node",
                 "does not inherit forged identity or boundary properties while drawing a new junction"]
DS006 = ["leaves the previously committed design and all source tables unchanged after late validation failure"]
DS006_CONTROL = ["rejects duplicate headings and a dangling connection before changing a design"]
DS007 = ["rejects unknown geometry units instead of assuming metres"]
DS007_CONTROL = ["parses quoted valid identifiers and labels, maps headers and converts feet and square feet explicitly"]
DS008 = ["enforces the UTF-8 byte limit rather than JavaScript string length"]
DS008_CONTROL = ["enforces network row caps before allocating an oversized design"]
DS009 = ["never accepts forged baseline result arrays or a forged convergence claim"]
DS009_CONTROL = ["stores baseline inputs without derived result arrays and recomputes them on device restore",
                 "allowlists scientific project fields and adds no source path or account metadata"]
DS010 = ["preserves the old stored workspace when validation fails before a write"]
DS010_CONTROL = ["recovers a fresh workspace from missing, blocked, malformed or invalid device storage"]
DS011 = "JSON imports preserve current inputs on failure and round-trip an edited operating state"


# ---------------------------------------------------------------- the clean copy passes every gate used below

@needs_node
def test_every_node_gate_of_design_passes_on_the_clean_copy(web: Path) -> None:
    assert_vitest_clean(web, EDITOR_TEST, DS001 + DS001_CONTROL + DS002 + DS003 + DS003_CONTROL + DS004 + DS005 + DS005_CONTROL)
    assert_vitest_clean(web, IMPORT_TEST, DS006 + DS006_CONTROL + DS007 + DS007_CONTROL + DS008 + DS008_CONTROL)
    assert_vitest_clean(web, STORAGE_TEST, DS009 + DS009_CONTROL + DS010 + DS010_CONTROL)


@needs_browser
def test_the_browser_journey_of_design_passes_on_the_clean_build(web: Path) -> None:
    assert_journeys_clean(web, "workbench.spec.ts", [DS011])


# ---------------------------------------------------------------- the editor

@needs_node
def test_ds_001_a_draw_that_mutates_the_original_design_is_caught(web: Path) -> None:
    # the new junction is pushed into the caller's node array (drawAirway only; the frozen-input test covers move, edit and split)
    plant_re(web, EDITOR, r"(  const next = )structuredClone\(network\);(\n  let toId: string;)",
             r"\1{ ...structuredClone(network), nodes: network.nodes };\2")
    assert_vitest_caught(web, EDITOR_TEST, DS001)


@needs_node
def test_ds_002_a_half_applied_transaction_is_caught(web: Path) -> None:
    # moveJunction, removeAirway and editAirway apply their change to the caller's design and only then validate it
    for name in ("moveJunction", "removeAirway", "editAirway"):
        plant_re(web, EDITOR, rf"(export function {name}\([\s\S]*?  const next = )structuredClone\(network\);", r"\1network;")
    assert_vitest_caught(web, EDITOR_TEST, DS002)


@needs_node
def test_ds_003_a_split_that_doubles_the_resistance_is_caught(web: Path) -> None:
    # each half keeps the full resistance, and the fan stays on both (the sub-minimum test guards the validation, not this)
    plant(web, EDITOR, "    resistance: edge.resistance * (1 - fraction),", "    resistance: edge.resistance,")
    plant(web, EDITOR, "  edge.resistance *= fraction;\n", "")
    plant(web, EDITOR, "  if (tail.fan) {", "  if (false as boolean) {")
    assert_vitest_caught(web, EDITOR_TEST, DS003)


@needs_node
def test_ds_004_a_move_onto_another_junction_is_caught(web: Path) -> None:
    plant_re(web, EDITOR, r"  validateLengths\(\s*clean,\s*clean\.edges\.filter\(\s*\(edge\) => edge\.from === nodeId \|\| edge\.to === nodeId\),?\s*\);\n", "")
    assert_vitest_caught(web, EDITOR_TEST, DS004)


@needs_node
def test_ds_005_a_forged_identity_through_a_property_edit_is_caught(web: Path) -> None:
    # the caller's object is spread into the airway: the allow-list of keys is gone, so a forged from or id is kept
    plant_re(web, EDITOR, r"  for \(const key of Object\.keys\(values\)\)\s*if \([\s\S]*?\)\s*throw new Error\(\s*`Airway \$\{key\} cannot be changed[^`]*`,?\s*\);\n", "")
    assert_vitest_caught(web, EDITOR_TEST, DS005)


# ---------------------------------------------------------------- the table importer

@needs_node
def test_ds_006_an_import_that_commits_before_it_validates_is_caught(web: Path) -> None:
    # the importer takes the source tables (reorders them in place) before the late validation of the whole network runs
    plant(web, IMPORTER, "  return validateNetwork({\n    schema: \"aerovia.network/v1\",\n    id: \"imported-tables\",",
          "  nodes.rows.reverse();\n  return validateNetwork({\n    schema: \"aerovia.network/v1\",\n    id: \"imported-tables\",")
    assert_vitest_caught(web, IMPORT_TEST, DS006)


@needs_node
def test_ds_007_an_unknown_unit_read_as_metres_is_caught(web: Path) -> None:
    plant(web, IMPORTER, 'if (units !== "m" && units !== "ft")', "if (false as boolean)")
    assert_vitest_caught(web, IMPORT_TEST, DS007)


@needs_node
def test_ds_008_a_string_length_limit_in_place_of_a_byte_limit_is_caught(web: Path) -> None:
    plant(web, IMPORTER, "new TextEncoder().encode(text).byteLength > TABLE_LIMITS.bytes", "text.length > TABLE_LIMITS.bytes")
    assert_vitest_caught(web, IMPORT_TEST, DS008)


# ---------------------------------------------------------------- the project storage

@needs_node
def test_ds_009_a_forged_baseline_result_restored_as_an_answer_is_caught(web: Path) -> None:
    plant(web, STORAGE, "  const result = solveNetwork(inputs.baseline.network, inputs.baseline.options)\n",
          "  const stored = (input as { baseline?: { result?: Result } }).baseline?.result\n"
          "  const result = stored ?? solveNetwork(inputs.baseline.network, inputs.baseline.options)\n")
    assert_vitest_caught(web, STORAGE_TEST, DS009)


@needs_node
def test_ds_010_a_workspace_cleared_before_its_replacement_is_valid_is_caught(web: Path) -> None:
    plant(web, STORAGE, "  const text = serializeProject(project, false)\n  const destination = storage ?? globalThis.localStorage\n",
          "  const destination = storage ?? globalThis.localStorage\n  destination.setItem(PROJECT_STORAGE_KEY, '')\n"
          "  const text = serializeProject(project, false)\n")
    assert_vitest_caught(web, STORAGE_TEST, DS010)


# ---------------------------------------------------------------- the project dialog

@needs_browser
def test_ds_011_a_failed_import_that_resets_the_inputs_is_caught(web: Path) -> None:
    plant(web, fe("src/workbench/ProjectDialog.tsx"), "        if (w.importText(text)) close();\n",
          "        const imported = w.importText(text);\n"
          "        if (!imported) w.change(w.network!, structuredClone(DEFAULT_OPTIONS));\n"
          "        if (imported) close();\n")
    assert_journeys_caught(web, "workbench.spec.ts", [DS011])

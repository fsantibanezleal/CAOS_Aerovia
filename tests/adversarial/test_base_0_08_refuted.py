"""Adversarial checks of the base-0-08 feature (the routes and the landing, the five groups of the App and Focus, the
executive view and its illustrations, the documentation areas and citations, the contract catalog and the readiness): one
planted defect per requirement, in a throwaway copy of the repository, and the requirement's own gate run on the copy.

Three kinds of gate are held here, each as ``_web_tools.py`` describes them:

* the frontend's vitest tests (BW-001, 004, 005, 006, 008, 010, 012, 013): a defect is planted in the copy's source or
  content, the named tests are run with node on the copy and must fail by name, while the same tests pass on the clean copy;
* the Python tests and guards of ``tests/contracts`` (BW-014 to BW-017): the defect is planted in the copy's catalog, schema,
  document or readiness code and the named tests, or the guard, run on the copy;
* the browser journeys of ``frontend/e2e`` (BW-002, 003, 007, 011): the planted source is built and served on port 4204 and
  the named journey must fail, while a clean build passes it. They skip when there is no Playwright browser.

BW-009 has no test here: its gate is the planted test that already exists in ``executive.test.ts``. Nothing here writes into
the real tree."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from _web_tools import (BROWSER_MISSING, BROWSER_REASON, NODE_MISSING, NODE_REASON, _negative_control, _utf8_output, assert_journeys_caught,  # noqa: F401
                        assert_journeys_clean, assert_pytest_caught, assert_pytest_clean, assert_vitest_caught,
                        assert_vitest_clean, edit_json, findings, fe, plant, plant_re, web, Site)
from planting import edit, guard

needs_node = pytest.mark.skipif(NODE_MISSING, reason=NODE_REASON)
needs_browser = pytest.mark.skipif(BROWSER_MISSING, reason=BROWSER_REASON)

ROUTES_TEST = "src/routes.test.ts"
GROUPS_TEST = "src/workbench/groups.test.ts"
EXECUTIVE_TEST = "src/content/executive.test.ts"
ILLUSTRATIONS_TEST = "src/content/illustrations.test.ts"
AREAS_TEST = "src/content/areas.test.ts"
CITATIONS_TEST = "src/content/citations.test.ts"

BW001 = ["renders the landing at the root and at every unknown path", "does not render the workbench at the root any more"]
BW004 = ["are design, airflow, transport, uncertainty and models, in that order", "with the Context view make at most six peer views (ADR-0071 rule 5)"]
BW005 = ["lands every old tool page in exactly one sub-view that exists", "leaves no sub-view without an old tool page behind it",
         "lists every tool page of today's six modes"]
BW006 = ["moves with the resistance scale"]
BW008 = ["the executive data is valid against schema 2.0.0 and the writing limits, in both languages",
         "the 4 C's are Choice, Context, Cost and Control, in that order, named in both languages",
         "every cited id is a source, every source is cited, each is a titled https link, and no sub-tab names more than six"]
BW010 = ["colours only with theme tokens, none or currentColor",
         "has keyframes, a reduced-motion block that stops them, and one loop of at most ten seconds"]
BW012 = ["declares an area of the page's vocabulary on every section", "has the five areas of the page, once each, in the shell's order"]
BW013 = ["are all used: no citation is left without a reference", "exist for every id a section or a Benchmark section references"]

GUARDS = "tests/contracts/test_guards.py"
READINESS = "tests/contracts/test_readiness.py"
BW014 = [f"{GUARDS}::test_the_catalog_has_a_row_for_every_boundary",
         f"{GUARDS}::test_a_swap_test_and_a_producer_test_name_a_real_test_in_every_row"]
BW016_CURRENT = f"{READINESS}::test_the_committed_document_is_current"
BW016_REFUSED = f"{READINESS}::test_a_status_the_rules_do_not_know_is_refused"
BW017 = [f"{READINESS}::test_an_absent_document_is_missing",
         f"{READINESS}::test_a_network_the_catalog_lists_but_cases_lacks_is_partial",
         f"{READINESS}::test_a_catalog_baked_by_another_engine_version_is_stale"]

HEADER = "the header order is App, Introduction, Methodology, Implementation, Experiments, Benchmark"
OLD_LINK = "an old App link reaches /app with its query string and its hash, and the App loads"
FOCUS = "a Focus link opens the stage on its case, group and sub-view, and the exit button leaves it"
INTRO = "the Introduction opens on the executive view, with no equation or glossary visible"


def second_copy(repo: Path, name: str) -> Path:
    """Another fresh copy beside the first, for a test with two plants that must not stack."""
    dest = repo.parent / name
    shutil.copytree(repo, dest)
    return dest


# ---------------------------------------------------------------- the clean copy passes every gate used below

@needs_node
def test_every_node_gate_of_base_0_08_passes_on_the_clean_copy(web: Path) -> None:
    assert_vitest_clean(web, ROUTES_TEST, BW001)
    assert_vitest_clean(web, GROUPS_TEST, BW004 + BW005 + BW006)
    assert_vitest_clean(web, EXECUTIVE_TEST, BW008)
    assert_vitest_clean(web, ILLUSTRATIONS_TEST, BW010)
    assert_vitest_clean(web, AREAS_TEST, BW012)
    assert_vitest_clean(web, CITATIONS_TEST, BW013)


def test_every_python_gate_of_base_0_08_passes_on_the_clean_copy(repo: Path) -> None:
    assert_pytest_clean(repo, BW014 + [BW016_CURRENT, BW016_REFUSED] + BW017)
    assert guard(repo, "check_contract_versions.py").returncode == 0
    assert guard(repo, "check_readiness.py").returncode == 0


@needs_browser
def test_every_browser_journey_of_base_0_08_passes_on_the_clean_build(web: Path) -> None:
    assert_journeys_clean(web, "routes.spec.ts", [HEADER, OLD_LINK])
    # the build is served once per call; the other two specs read the same build
    with Site(web) as site:
        for spec, title in (("groups.spec.ts", FOCUS), ("documentation.spec.ts", INTRO)):
            code, results, out = site.journeys(spec, [title])
            assert code == 0 and results.get(title) is True, out


# ---------------------------------------------------------------- the routes and the landing

@needs_node
def test_bw_001_a_root_that_renders_the_workbench_is_caught(web: Path) -> None:
    plant(web, fe("src/routes.ts"), '{ path: "/", page: "landing" },', '{ path: "/", page: "app" },')
    assert_vitest_caught(web, ROUTES_TEST, BW001)


@needs_browser
def test_bw_002_a_header_with_the_app_last_is_caught(web: Path) -> None:
    plant(web, fe("src/main.tsx"), "routes: STANDARD_ROUTES,", "routes: [...STANDARD_ROUTES.slice(1), STANDARD_ROUTES[0]],")
    assert_journeys_caught(web, "routes.spec.ts", [HEADER])


@needs_browser
def test_bw_003_a_forward_that_drops_the_query_string_is_caught(web: Path) -> None:
    # the shell's Landing forwards `/?case=B2#x` to `/app?case=B2#x`; the plant is a landing that forwards to a bare `/app`
    main = fe("src/main.tsx")
    plant(web, main, 'import { BrowserRouter, Routes, Route } from "react-router";',
          'import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";')
    plant(web, main, "const ELEMENT: Record<PageName, React.ReactNode> = {",
          "function ForwardWithoutQuery() {\n  const { search } = useLocation();\n"
          '  return search ? <Navigate to="/app" replace /> : <Landing />;\n}\n'
          "const ELEMENT: Record<PageName, React.ReactNode> = {")
    plant(web, main, "landing: <Landing />,", "landing: <ForwardWithoutQuery />,")
    assert_journeys_caught(web, "routes.spec.ts", [OLD_LINK])


# ---------------------------------------------------------------- the five groups of the App

@needs_node
def test_bw_004_a_sixth_group_over_the_peer_limit_is_caught(web: Path) -> None:
    plant(web, fe("src/workbench/groups.ts"), "export const GROUPS: readonly GroupDef[] = [",
          "export const GROUPS: readonly GroupDef[] = [\n"
          '  { id: "extra" as GroupId, en: "Extra", es: "Extra", title: { en: "Extra", es: "Extra" },'
          ' subs: [{ id: "primary", en: "Extra", es: "Extra" }] },')
    assert_vitest_caught(web, GROUPS_TEST, BW004)


@needs_node
def test_bw_005_a_tool_page_with_no_sub_view_or_two_is_caught(web: Path) -> None:
    groups = fe("src/workbench/groups.ts")
    plant(web, groups, 'page("design", "node", "design", "node"),', 'page("design", "node", "design", "nowhere"),')
    plant(web, groups, 'page("flow", "primary", "airflow", "primary"),',
          'page("flow", "primary", "airflow", "primary"),\n  page("flow", "primary", "airflow", "duty"),')
    assert_vitest_caught(web, GROUPS_TEST, BW005)


@needs_node
def test_bw_006_a_selection_key_that_ignores_the_resistance_scale_is_caught(web: Path) -> None:
    plant(web, fe("src/workbench/railState.ts"), "    resistance: options.resistanceScale,\n", "")
    assert_vitest_caught(web, GROUPS_TEST, BW006)


@needs_browser
def test_bw_007_a_focus_exit_that_resets_the_group_is_caught(web: Path) -> None:
    plant(web, fe("src/workbench/Workbench.tsx"), "focus={{ hud: s.hud, onChange: setFocusOn }}",
          'focus={{ hud: s.hud, onChange: (on: boolean) => { setFocusOn(on); if (!on) selectGroup("design"); } }}')
    assert_journeys_caught(web, "groups.spec.ts", [FOCUS])


# ---------------------------------------------------------------- the executive view

@needs_node
def test_bw_008_an_executive_file_over_its_limits_is_caught(web: Path) -> None:
    clean = guard(web, "check_sdd.py")

    def plant_executive(doc: dict) -> None:
        doc["pain"]["key_message"]["en"] = " ".join(["word"] * 39) + "."  # a sentence of 40 words, the limit is 30
        doc["proposal"]["four_cs"].reverse()  # the 4 C's out of order
        doc["sources"].append({"id": "never-cited", "title": {"en": "A source no figure cites", "es": "Una fuente que ninguna cifra cita"},
                               "url": "https://example.org/never-cited"})

    edit_json(web, "content/executive.json", plant_executive)
    assert_vitest_caught(web, EXECUTIVE_TEST, BW008)
    planted = guard(web, "check_sdd.py")
    assert planted.returncode != 0
    added = findings(planted) - findings(clean)
    assert any("executive" in line.lower() for line in added), sorted(added)[:10]


@needs_node
def test_bw_010_an_illustration_with_a_raw_colour_or_no_reduced_motion_is_caught(web: Path) -> None:
    pain = fe("public/executive/pain.svg")
    plant(web, pain, 'fill="var(--color-surface)"', 'fill="#3366cc"')
    plant_re(web, pain, r"@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}", "")
    assert_vitest_caught(web, ILLUSTRATIONS_TEST, BW010)


@needs_browser
def test_bw_011_an_introduction_that_opens_on_the_technical_view_is_caught(web: Path) -> None:
    plant(web, fe("src/pages/Introduction.tsx"), "initial={initial}", 'initial={initial ?? "technical"}')
    assert_journeys_caught(web, "documentation.spec.ts", [INTRO])


# ---------------------------------------------------------------- the documentation areas and citations

@needs_node
def test_bw_012_a_section_without_an_area_or_a_repeated_area_is_caught(web: Path) -> None:
    intro = fe("src/content/introduction.ts")
    plant(web, intro, '    area: "principles",\n', "")  # one section loses its area
    plant(web, intro, '    area: "math",', '    area: "problem",')  # two sections share the first one
    assert_vitest_caught(web, AREAS_TEST, BW012)


@needs_node
def test_bw_013_an_unused_citation_and_an_unknown_id_are_caught(web: Path) -> None:
    plant(web, fe("src/content/citations/introduction.ts"), "export const introductionCitations: Citation[] = [",
          "export const introductionCitations: Citation[] = [\n"
          '  { id: "never-referenced", label: "Planted", citation: "A citation no section references.", url: "https://example.org/planted" },')
    plant(web, fe("src/content/introduction.ts"), 'refs: ["mcpherson1993", "nioshmfire"],',
          'refs: ["mcpherson1993", "nioshmfire", "no-such-citation"],')
    assert_vitest_caught(web, CITATIONS_TEST, BW013)


# ---------------------------------------------------------------- the contract catalog and the readiness

def test_bw_014_a_missing_row_and_an_imaginary_producer_test_are_caught(repo: Path) -> None:
    catalog = "docs/contracts/catalog.md"
    plant_re(repo, catalog, r"^\| science \|[^\n]*\n", "", flags=re.M)  # the Contracts table's row, not the History's
    edit(repo, catalog, "test_pipeline_and_schema_agree_on_every_network", "test_that_does_not_exist")
    assert_pytest_caught(repo, BW014)


def test_bw_015_a_schema_changed_under_the_same_version_is_caught(repo: Path) -> None:
    clean = guard(repo, "check_contract_versions.py")
    assert clean.returncode == 0, clean.stdout

    def require_a_new_field(schema: dict) -> None:
        schema["properties"]["plantedField"] = {"type": "string"}
        schema["required"].append("plantedField")

    edit_json(repo, "docs/contracts/schemas/project.schema.json", require_a_new_field)
    planted = guard(repo, "check_contract_versions.py")
    assert planted.returncode == 1, planted.stdout
    assert "project" in planted.stdout


def test_bw_016_a_stale_readiness_and_an_unknown_status_are_caught(repo: Path) -> None:
    # (1) a catalog newer than the readiness document: the sha it is bound to no longer matches
    stale = second_copy(repo, "stale")
    edit(stale, "docs/contracts/catalog.md", "# Contract catalog: Aerovia", "# Contract catalog: Aerovia (edited)")
    assert_pytest_caught(stale, [BW016_CURRENT])
    assert guard(stale, "check_readiness.py").returncode == 1
    # (2) a row status the rules do not know
    unknown = second_copy(repo, "unknown")
    edit(unknown, "docs/contracts/catalog.md", "| real |", "| done |")
    assert_pytest_caught(unknown, [BW016_CURRENT])
    assert guard(unknown, "check_readiness.py").returncode == 1
    # (3) a readiness that no longer refuses the unknown status: the refusal's own test must fail
    edit(repo, "data-pipeline/aerovia_pipeline/readiness.py", 'if row["status"] not in STATUSES:', "if False:")
    assert_pytest_caught(repo, [BW016_REFUSED])


def test_bw_017_a_tree_that_is_partial_or_stale_but_reads_available_is_caught(repo: Path) -> None:
    # (1) the readiness code names partial and stale on a tree that lacks a network and an ONNX file and was baked by another engine
    probe = second_copy(repo, "probe")
    edit_json(probe, "data/cases.json", lambda cases: cases.pop(3))
    (probe / "data" / "models" / "topology-mlp" / "hard-rock.onnx").unlink()
    edit_json(probe, "data/artifacts/catalog.json", lambda doc: doc["benchmark"].__setitem__("engineVersion", "0.0.9"))
    code = ("import json, sys; sys.path.insert(0, 'data-pipeline')\n"
            "from aerovia_pipeline import readiness\n"
            "doc = readiness.compute(repo_root='.')\n"
            "print(json.dumps({e['id']: e['state'] for e in doc['contracts']}))")
    r = subprocess.run([sys.executable, "-c", code], cwd=probe, capture_output=True, encoding="utf-8")
    assert r.returncode == 0, r.stderr
    states = json.loads(r.stdout)
    assert (states["network"], states["model-io"], states["catalog"]) == ("partial", "partial", "stale"), states
    # (2) a readiness that reads available whatever the tree holds: the three named tests must fail
    rd = "data-pipeline/aerovia_pipeline/readiness.py"
    edit(repo, rd, 'if rid == "network" and f.networks_missing:', "if False:")
    edit(repo, rd, "if rid in STALE_ROWS and f.engine_version != ENGINE_VERSION:", "if False:")
    edit(repo, rd, "if rid in DOCUMENT and not (f.data / DOCUMENT[rid]).is_file():", "if False:")
    assert_pytest_caught(repo, BW017)

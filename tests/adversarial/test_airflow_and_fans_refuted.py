"""Plants for the airflow-and-fans feature (AF-001 to AF-013): one planted defect per requirement, in a throwaway copy, and
the requirement's own gate run on the copy.

The gates are the vitest tests of ``frontend/src/engine.test.ts`` and ``frontend/src/components/FanPlot.test.ts`` (run with
node on a copy that links the real ``node_modules``) and, for AF-012, the pytest tests of ``tests/python/test_model.py``
(run as a subprocess on a copy). Each test asserts that the gate it names ran and failed on the plant, after the same file
passed on a clean copy (the control, run once per file set). The vitest plants are local-only: they skip where node or
``npm ci`` is absent, as the checks job has node and the install but a plant is cheap to run only here."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from _engine_tools import needs_web, py_plant, sha256_of, vitest_results, web_copy, web_plant
from planting import edit

ENGINE = "src/engine.test.ts"
FANPLOT = "src/components/FanPlot.test.ts"
SOLVER = "src/engine/solver.ts"
VALIDATION = "src/engine/validation.ts"
ANALYSIS = "src/engine/analysis.ts"
FACTORY = pytest.TempPathFactory

SERIES = "matches the series resistance, pressure, velocity and electrical-power solution"
PARALLEL = "matches parallel resistance and flow distribution"


@needs_web
def test_af_001_a_resistance_scaled_in_the_newton_step_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # a uniform factor on every branch would leave the solution unchanged (the fan head is a pressure, not a resistance, but the
    # scale cancels in the series loop), so the factor is put on the branches above the median resistance only
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(SOLVER, "const rootR = Math.sqrt(branch.resistance / resistanceScale)",
                "const rootR = Math.sqrt((branch.resistance > resistanceScale ? 1.01 : 1) * branch.resistance / resistanceScale)")],
              [SERIES, PARALLEL])


@needs_web
def test_af_002_a_fan_head_linear_in_speed_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(SOLVER, "source: (edge.fan?.pressure ?? 0) * options.speed ** 2,", "source: (edge.fan?.pressure ?? 0) * options.speed,")],
              ["obeys common-speed flow, pressure and fan cube laws"])


@needs_web
def test_af_003_a_junction_balance_that_drops_an_airway_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # the Newton residual forgets the airway that leaves each junction: the solved pressures leave a mass imbalance that the
    # acceptance check on the original equations measures
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(SOLVER, "      if (v >= 0) residual[v] -= q\n", "")],
              ["conserves at a dead end and a zero-flow branch"])


@needs_web
def test_af_004_an_isolated_component_anchored_at_an_arbitrary_pressure_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # the isolation test is removed and the unreached nodes are solved as if grounded: an unsupported state is answered
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(SOLVER, "const floating = ungroundedNodes(network, closed)", "const floating: string[] = []")],
              ["returns an explicit failure if airway closures isolate internal nodes"])


@needs_web
def test_af_005_a_zero_resistance_airway_accepted_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(VALIDATION, "resistance: numeric(e.resistance, `edges[${i}].resistance`, 1e-6, 1e6),", "resistance: numeric(e.resistance, `edges[${i}].resistance`, 0, 1e6),")],
              ["rejects zero resistance, duplicate IDs, unknown endpoints and absent boundaries"])


@needs_web
def test_af_006_an_option_clamped_in_place_of_rejected_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(VALIDATION, "speed: numeric(data.speed, 'speed', 0, LIMITS.maxSpeed),", "speed: Math.min(LIMITS.maxSpeed, numeric(data.speed, 'speed', 0, Infinity)),")],
              ["rejects invalid options rather than clamping scientific inputs"])


@needs_web
def test_af_007_reverse_fan_power_reported_as_useful_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(SOLVER, "if (q < -MASS_TOLERANCE || (q > MASS_TOLERANCE && delivery < -PRESSURE_TOLERANCE)) unsupportedFans.push(edge.id)", "if (false) unsupportedFans.push(edge.id)"),
               (SOLVER, "if (q > 0 && delivery > 0) fanPowerKW += delivery * q / (edge.fan.efficiency * 1000)", "fanPowerKW += Math.abs(delivery * q) / (edge.fan.efficiency * 1000)")],
              ["flags reverse fan operation instead of inventing useful fan power", "flags forward fan operation with negative delivered pressure"])


@needs_web
def test_af_008_a_bisection_that_returns_its_upper_bound_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(ANALYSIS, "return { feasible: true, speed: high, result, evaluations }", "return { feasible: true, speed: LIMITS.maxSpeed, result, evaluations }"),
               (ANALYSIS, "if (boundaries.some(pressure => pressure !== boundaries[0])) {", "if (false) {")],
              ["finds the known minimum feasible common fan speed", "does not assert a monotone optimum with unequal boundary pressures"])


@needs_web
def test_af_009_a_sensitivity_of_the_wrong_airway_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # the perturbation lands on the first airway whatever airway is reported
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(ANALYSIS, "...options.overrides, [edge.id]: { ...options.overrides[edge.id], resistance: resistance * 1.05 },",
                "...options.overrides, [network.edges[0].id]: { ...options.overrides[network.edges[0].id], resistance: network.edges[0].resistance * 1.05 },")],
              ["computes resistance sensitivity against a closed-form perturbation"])
    # the sweep is two solves (the fan off and the nominal speed) joined by a straight line instead of 21 solutions: the
    # cube law of power at the maximum speed is lost
    old = "    const result = solveValidated(network, { ...options, speed })\n"
    new = ("    const lo = solveValidated(network, { ...options, speed: 0 }), hi = solveValidated(network, { ...options, speed: 1 })\n"
           "    const lerp = (a: number, b: number) => a + (b - a) * speed\n"
           "    const result = { ...hi, converged: true, totalIntake: lerp(lo.totalIntake, hi.totalIntake), fanPowerKW: lerp(lo.fanPowerKW, hi.fanPowerKW),\n"
           "      flows: hi.flows.map((v, k) => lerp(lo.flows[k], v)) }\n")
    web_plant(tmp_path / "sweep", tmp_path_factory, ENGINE, [(ANALYSIS, old, new)],
              ["generates a fan sweep from actual solutions including zero and maximum speed"])


@needs_web
def test_af_010_a_limit_below_the_declared_size_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, ENGINE,
              [(VALIDATION, "nodes: 120, edges: 240", "nodes: 100, edges: 240")],
              ["solves a connected network at the 120-node / 240-edge browser limits"])


@needs_web
def test_af_011_a_shifted_reference_flow_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    """One flow of one case of the reference catalog is shifted by 1e-3 m3/s and the recorded digest of the file is fixed to
    match: the per-case reference test of that case must fail (the file-level check of the named test only counts the cases)."""
    from _engine_tools import assert_web_clean
    assert_web_clean(tmp_path_factory, ENGINE)
    with web_copy(tmp_path / "web") as tree:
        catalog = tree / "data" / "artifacts" / "catalog.json"
        data = json.loads(catalog.read_text(encoding="utf-8"))
        victim = data["cases"][0]
        victim["result"]["flows"][0] += 1e-3
        catalog.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        manifest = tree / "data" / "artifacts" / "manifest.json"
        listing = json.loads(manifest.read_text(encoding="utf-8"))
        listing["files"]["catalog.json"] = {"sha256": sha256_of(catalog), "bytes": catalog.stat().st_size}
        manifest.write_text(json.dumps(listing, ensure_ascii=False, indent=2), encoding="utf-8")
        code, results, out = vitest_results(tree, ENGINE)
    name = f"matches independent flow, pressure and power for {victim['network']['id']}"
    assert code != 0 and results.get(name) == "failed", out[-2000:]
    assert results["requires a complete numerical reference artifact"] == "passed"  # the count alone cannot see the shift


def test_af_012_a_reference_with_a_wrong_split_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # the branch resistance enters the solve as its inverse: the parallel split is weighted by the resistance
    gates = ["tests/python/test_model.py::test_analytic_series_flow_pressure_and_electric_power",
             "tests/python/test_model.py::test_analytic_parallel_split_and_equivalent_resistance"]
    py_plant(tmp_path, tmp_path_factory, [("data-pipeline/aerovia_pipeline/model.py", "effective = r + model[\"k\"]", "effective = 1.0 / r + model[\"k\"]")], gates)


@needs_web
def test_af_013_a_fan_plot_without_its_guards_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, FANPLOT,
              [("src/components/FanPlot.tsx", "  if (!active.length) return { kind: \"all-closed\" };\n", ""),
               ("src/components/FanPlot.tsx", "if (!result.converged || result.flows.length !== network.edges.length)", "if (!result.converged)")],
              ["does not display delivered pressure for a closed fan branch", "cannot use a stale result with the wrong number of airways"])

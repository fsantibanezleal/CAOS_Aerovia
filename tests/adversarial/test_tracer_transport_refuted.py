"""Adversarial checks of the tracer-transport feature (conservative passive transport and directed routes): one planted defect
per requirement, in a throwaway copy of the repository, and the requirement's own gate run on the copy.

The gates are the frontend's vitest tests of the integrator (``transport.test.ts``) and of the route analysis
(``routing.test.ts``). A defect is planted in the copy's ``transport.ts`` or ``routing.ts``, the named tests are run with node
on the copy (the real ``node_modules`` is linked in, see ``_web_tools.py``) and must fail by name, while the same tests pass on
the clean copy. A requirement that lists several gate tests lists each for a part of its statement: a plant fails the tests of
the part it breaks, and the row says where a second plant covers another part. Nothing here writes into the real tree."""
from __future__ import annotations

from pathlib import Path

import pytest
from _web_tools import (NODE_MISSING, NODE_REASON, _negative_control, _utf8_output, assert_vitest_caught, assert_vitest_clean, fe, fork,  # noqa: F401
                        plant, plant_re, web)

needs_node = pytest.mark.skipif(NODE_MISSING, reason=NODE_REASON)

TRANSPORT_TEST = "src/engine/transport.test.ts"
ROUTING_TEST = "src/engine/routing.test.ts"
TRANSPORT = fe("src/engine/transport.ts")
ROUTING = fe("src/engine/routing.ts")

TT001 = ["matches one mixed volume exponential washout and independently closes the ledger"]
TT002 = ["converges at second order in time against the exact mixed-volume solution"]
TT003 = ["matches the independent Erlang survival expression for four airway cells"]
TT004_MIX = ["mixes incoming flux at an internal junction without duplicating tracer"]
TT004_SPLIT = ["splits outgoing tracer flux according to actual airflow"]
TT005 = ["exports incoming tracer at a pressure boundary rather than recycling it into outgoing air"]
TT006 = ["retains tracer while closed and resumes transport at the exact reopening event"]
TT006_ZERO = ["retains trapped mass in a closed branch and accounts for decay with zero airflow"]
TT007 = ["is physically identical under edge reversal with the source position mapped"]
TT007_INTERFACE = ["places a source on a cell interface symmetrically under orientation reversal"]
TT008 = ["rejects excessive integration work before stepping instead of silently changing inputs"]
TT009 = ["rejects volume-changing schedules and ambiguous simultaneous operating states",
         "refuses unsupported disconnected airflow instead of generating a fabricated concentration"]
TT010 = ["integrates finite continuous release and subsequent washout without extending the source"]
TT010_PULSE = ["aligns a pulse exactly to an output time and does not smear its injection"]
TT011 = ["chooses least nominal advective transit even when that route is geometrically longer"]
TT012 = ["terminates an air parcel at an external pressure boundary",
         "never reports a cycle through a clean external reservoir as internal recirculation",
         "represents closed and stagnant airways without fictitious finite travel times"]
ALL_TRANSPORT = (TT001 + TT002 + TT003 + TT004_MIX + TT004_SPLIT + TT005 + TT006 + TT006_ZERO + TT007 + TT007_INTERFACE + TT008
                 + TT009 + TT010 + TT010_PULSE)


# ---------------------------------------------------------------- the clean copy passes every gate used below

@needs_node
def test_every_node_gate_of_tracer_transport_passes_on_the_clean_copy(web: Path) -> None:
    assert_vitest_clean(web, TRANSPORT_TEST, ALL_TRANSPORT)
    assert_vitest_clean(web, ROUTING_TEST, TT011 + TT012)


# ---------------------------------------------------------------- the integrator

@needs_node
def test_tt_001_an_escaped_mass_missing_from_the_ledger_is_caught(web: Path) -> None:
    plant(web, TRANSPORT, "        escaped += dt * 0.5 * (escape1 + escape2);\n", "")
    assert_vitest_caught(web, TRANSPORT_TEST, TT001)


@needs_node
def test_tt_002_a_first_order_update_is_caught(web: Path) -> None:
    plant(web, TRANSPORT, "          mass[i] = 0.5 * mass[i] + 0.5 * (stage[i] + dt * d2[i]);", "          mass[i] = stage[i];")
    assert_vitest_caught(web, TRANSPORT_TEST, TT002)


@needs_node
def test_tt_003_a_wrong_cell_volume_is_caught(web: Path) -> None:
    plant(web, TRANSPORT, "(edge, i) => lengths[i] * (options.overrides[edge.id]?.area ?? edge.area),",
          "(edge, i) => lengths[i] * lengths[i] * (options.overrides[edge.id]?.area ?? edge.area),")
    assert_vitest_caught(web, TRANSPORT_TEST, TT003)


@needs_node
def test_tt_004_a_junction_that_duplicates_tracer_is_caught(web: Path) -> None:
    with fork(web, "second") as second:
        # each outgoing airway receives the full incoming flux instead of its share of the actual airflow
        plant(web, TRANSPORT, "(nodeFlux[u] * flow.magnitude[e]) / flow.outward[u];", "nodeFlux[u];")
        assert_vitest_caught(web, TRANSPORT_TEST, TT004_SPLIT)
        # the junction counts what it receives twice: the mixing test, whose junction has one outgoing airway, is the gate
        plant(second, TRANSPORT, "else nodeFlux[flow.downstream[e]] += flux;", "else nodeFlux[flow.downstream[e]] += 2 * flux;")
        assert_vitest_caught(second, TRANSPORT_TEST, TT004_MIX)


@needs_node
def test_tt_005_a_boundary_that_recycles_escaped_tracer_is_caught(web: Path) -> None:
    plant(web, TRANSPORT, "        else if (boundary[flow.downstream[e]]) escapedRate += flux;\n        else nodeFlux", "        else nodeFlux")
    plant(web, TRANSPORT, "      if (!boundary[u] && flow.outward[u] > 0)\n        output[flow.firstCell[e]]",
          "      if (flow.outward[u] > 0)\n        output[flow.firstCell[e]]")
    assert_vitest_caught(web, TRANSPORT_TEST, TT005)


@needs_node
def test_tt_006_a_closure_that_erases_the_stored_tracer_is_caught(web: Path) -> None:
    plant(web, TRANSPORT,
          "    while (\n      stateIndex + 1 < flowStates.length &&\n      flowStates[stateIndex + 1].timeSeconds <= event\n    )\n      stateIndex++;\n    for (const release of releases)\n      if (release.start === event",
          "    while (\n      stateIndex + 1 < flowStates.length &&\n      flowStates[stateIndex + 1].timeSeconds <= event\n    ) {\n      stateIndex++;\n"
          "      for (let e = 0; e < network.edges.length; e++)\n        if (prepared[stateIndex].magnitude[e] === 0) mass.fill(0, e * cells, (e + 1) * cells);\n    }\n"
          "    for (const release of releases)\n      if (release.start === event")
    assert_vitest_caught(web, TRANSPORT_TEST, TT006)


@needs_node
def test_tt_007_a_source_position_that_depends_on_orientation_is_caught(web: Path) -> None:
    # the position is measured from the downstream end of the solved flow, not from the airway's own from-endpoint
    plant(web, TRANSPORT, "    const scaled = position * cells;",
          "    const scaled = (solveNetwork(network, options).flows[edge] >= 0 ? 1 - position : position) * cells;")
    assert_vitest_caught(web, TRANSPORT_TEST, TT007)


@needs_node
def test_tt_008_a_workload_coarsened_in_silence_is_caught(web: Path) -> None:
    plant_re(web, TRANSPORT, r"if \(\s*predictedSteps > TRANSPORT_LIMITS\.steps \|\|\s*predictedSteps \* cells \* network\.edges\.length > TRANSPORT_LIMITS\.cellSteps\s*\)",
             "if (false as boolean)")
    plant_re(web, TRANSPORT, r"stableStep: Math\.min\(\s*maxStep,\s*maxRemoval > 0 \? TRANSPORT_LIMITS\.cfl / maxRemoval : Infinity,\s*\),",
             "stableStep: Math.max(Math.min(maxStep, maxRemoval > 0 ? TRANSPORT_LIMITS.cfl / maxRemoval : Infinity), duration / 50),")
    assert_vitest_caught(web, TRANSPORT_TEST, TT008)


@needs_node
def test_tt_009_a_schedule_that_changes_the_volume_is_caught(web: Path) -> None:
    plant_re(web, TRANSPORT, r"if \(\s*\(options\.overrides\[edge\.id\]\?\.area \?\? edge\.area\) !==\s*\(base\.overrides\[edge\.id\]\?\.area \?\? edge\.area\)\s*\)",
             "if (false as boolean)")
    plant(web, TRANSPORT, "  const failed = flowStates.find((state) => !state.result.converged);",
          "  const failed = undefined as (typeof flowStates)[number] | undefined;")
    assert_vitest_caught(web, TRANSPORT_TEST, TT009)


@needs_node
def test_tt_010_a_source_extended_past_its_end_is_caught(web: Path) -> None:
    # the continuous release is not cut at its end: its source runs on to the end of the simulation
    plant(web, TRANSPORT, "      end: Math.min(duration, start + releaseDuration),", "      end: duration,")
    assert_vitest_caught(web, TRANSPORT_TEST, TT010)


# ---------------------------------------------------------------- the route analysis

@needs_node
def test_tt_011_a_geometric_weight_in_place_of_transit_is_caught(web: Path) -> None:
    plant(web, ROUTING, "const candidate = distance[u] + edge.nominalTransitSeconds!;", "const candidate = distance[u] + edge.length;")
    assert_vitest_caught(web, ROUTING_TEST, TT011[:1])


@needs_node
def test_tt_012_a_route_through_a_clean_reservoir_is_caught(web: Path) -> None:
    plant(web, ROUTING, "    if (u !== source && network.nodes[u].boundary !== undefined) continue;\n", "")
    plant(web, ROUTING, "      if (network.nodes[v].boundary !== undefined) continue;\n", "")
    plant(web, ROUTING, "if (network.nodes[i].boundary === undefined && discovery[i] === -1)", "if (discovery[i] === -1)")
    plant(web, ROUTING, "const active = magnitude > 0 && !options.overrides[edge.id]?.closed;", "const active = true;")
    plant(web, ROUTING, "nominalTransitSeconds: active ? (lengths[i] * area) / magnitude : null,",
          "nominalTransitSeconds: (lengths[i] * area) / Math.max(magnitude, 1e-9),")
    assert_vitest_caught(web, ROUTING_TEST, TT012)

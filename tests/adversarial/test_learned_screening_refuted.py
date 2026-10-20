"""Plants for the learned-screening feature (LS-001 to LS-010): one planted defect per requirement, in a throwaway copy, and
the requirement's own gate run on the copy.

The gates are the pytest tests of ``tests/python/test_surrogates.py`` and ``tests/contracts/test_models.py`` (pytest in a
subprocess on the copy; the two that train or run the graph network need torch and skip without it, the ONNX ones need onnx),
the vitest tests of ``frontend/src/learned/domain.test.ts`` (node on a copy that links the real ``node_modules``, local-only)
and the browser journey of ``frontend/e2e/workbench.spec.ts`` (a built copy served on port 4203 and Playwright, local-only)."""
from __future__ import annotations

from pathlib import Path

import pytest
from _engine_tools import (assert_py_clean, assert_py_fails, browser_plant, edit_json, needs_browser, needs_web, py_copy, py_plant,
                           web_plant)
from planting import edit

FACTORY = pytest.TempPathFactory
SUR = "tests/python/test_surrogates.py::"
MODELS = "tests/contracts/test_models.py::"
PIPE = "data-pipeline/aerovia_pipeline/"
DOMAIN = "src/learned/domain.test.ts"


def test_ls_001_a_projector_that_changes_an_exact_flow_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # the inverse of the incidence Gram matrix is dropped: the projector no longer leaves a conserved flow unchanged (the
    # preprocessing refuses it too, so the gates stop at their fixture)
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "surrogate_data.py", 'projector = np.eye(len(net["edges"])) - bi.T @ np.linalg.solve(bi @ bi.T, bi)',
               'projector = np.eye(len(net["edges"])) - bi.T @ bi')],
             [SUR + "test_conservation_projector_is_identity_on_independent_reference"])


def test_ls_002_a_test_seed_leaked_into_training_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # one sample is the same in every split drawn: the seeds overlap
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "surrogate_data.py", "    factors = np.clip(factors, *FACTOR_BOUNDS)\n", "    factors = np.clip(factors, *FACTOR_BOUNDS)\n    factors[0] = 1.0\n")],
             [SUR + "test_split_seeds_are_reproducible_and_disjoint"])


@needs_web
def test_ls_003_an_extrapolation_clipped_into_the_domain_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, DOMAIN,
              [("src/learned/domain.ts", "options.resistanceScale / entry.baseResistances[i]);",
                "options.resistanceScale / entry.baseResistances[i]).map(v => Math.min(entry.factorBounds[1], Math.max(entry.factorBounds[0], v)));")],
              ["rejects unknown topology, closure, curve edit and extrapolation explicitly"])


def test_ls_004_a_target_in_the_feature_vector_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "surrogate_data.py", "np.log(factors).astype(np.float32)",
               'np.append(np.log(factors), sum(v.get("target", 0) for v in overrides.values())).astype(np.float32)')],
             [SUR + "test_area_and_target_do_not_enter_hydraulic_feature_path"])


@needs_web
def test_ls_005_a_finite_prediction_marked_converged_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # the flag is set in resultFromArrays (frontend/src/learned/index.ts), which domain.test.ts calls
    web_plant(tmp_path, tmp_path_factory, DOMAIN,
              [("src/learned/index.ts", "const converged = massResidual <= MASS_TOLERANCE && pressureResidual <= PRESSURE_TOLERANCE && !unsupportedFan;",
                "const converged = true;")],
              ["does not present a perturbed output as a converged physical solution"])


def test_ls_006_a_positional_edge_embedding_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    pytest.importorskip("torch")
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "surrogate_models.py", '        nodes = self.node_encoder(graph["node_static"])',
               '        edges = edges + .1 * torch.arange(edges.shape[1], dtype=edges.dtype).view(1, -1, 1)\n        nodes = self.node_encoder(graph["node_static"])')],
             [SUR + "test_gnn_is_equivariant_to_node_and_edge_permutation"])


def test_ls_007_a_resume_that_reseeds_the_generator_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    pytest.importorskip("torch")
    py_plant(tmp_path, tmp_path_factory,
             [(PIPE + "surrogate_train.py", '        generator.set_state(state["shuffleState"])', "        generator.manual_seed(seed)"),
              (PIPE + "surrogate_train.py", '        torch.set_rng_state(state["torchState"])', "        torch.manual_seed(seed)")],
             [SUR + "test_resume_preserves_training_state_exactly"])


def test_ls_008_a_registry_width_that_differs_from_the_graph_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    pytest.importorskip("onnx")
    gates = [MODELS + "test_every_onnx_file_has_the_io_its_registry_entry_declares[bake]",
             MODELS + "test_registry_entries_agree_with_the_manifest_and_the_networks[bake]"]
    refutation = MODELS + "test_an_onnx_file_whose_io_differs_from_its_entry_fails"
    assert_py_clean(tmp_path_factory, *gates, refutation)
    tree = py_copy(tmp_path / "width")

    def widen(registry: dict) -> None:
        registry["entries"][0]["input"]["shape"][1] += 1  # one more than the graph declares

    edit_json(tree, "data/models/registry.json", widen)
    assert_py_fails(tree, *gates)
    # the helper that compares an entry with its graph stops comparing: the refutation test must see it
    tree2 = py_copy(tmp_path / "helper")
    edit(tree2, "tests/contracts/support.py", 'float32")\n    return problems', 'float32")\n    return []')
    assert_py_fails(tree2, refutation)


def test_ls_009_a_checkpoint_without_a_key_or_with_a_pickle_payload_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    gate = MODELS + "test_a_checkpoint_missing_a_key_is_rejected_and_a_hostile_pickle_refused"
    # the reader runs any global a pickle names
    py_plant(tmp_path / "reader", tmp_path_factory,
             [("tests/contracts/pt_reader.py", '        raise pickle.UnpicklingError(f"global {module}.{name} is not allowed in a checkpoint")',
               "        return super().find_class(module, name)")], [gate])
    # the schema stops requiring the weights
    tree = py_copy(tmp_path / "schema")
    edit(tree, "docs/contracts/schemas/checkpoint.schema.json", '    "stateDict",\n', "")
    assert_py_fails(tree, gate)


@needs_browser
@pytest.mark.full_plants
def test_ls_010_a_changed_topology_answered_by_the_nearest_model_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    fabricated = ("(r) => r.status === 'out-of-domain' ? { ...r, status: 'supported', prediction: { status: 'supported', lane: 'live-wasm', "
                  "modelVersion: 'nearest', rawFlows: reference.flows, result: reference, errors: reference.flows.map(() => 0), "
                  "metrics: { flowMAE: 0, flowRMSE: 0, flowMaxError: 0, pressureMAE: 0, pressureMaxError: 0, powerAbsErrorKW: 0 } } } : r")
    browser_plant(tmp_path, tmp_path_factory, "e2e/workbench.spec.ts",
                  "learned fields are labeled approximations and reject a changed topology without substituting fabricated output",
                  [("src/workbench/LearnedComparison.tsx", "responses: Object.fromEntries(values),",
                    f"responses: Object.fromEntries(values.map(([m, r]) => [m, ({fabricated})(r)])),")])

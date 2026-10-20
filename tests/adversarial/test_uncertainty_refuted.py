"""Plants for the uncertainty feature (UQ-001 to UQ-007): one planted defect per requirement, in a throwaway copy, and the
requirement's own gate run on the copy.

The gates are the model tests of ``tests/python/test_model.py`` (pytest in a subprocess on the copy), the vitest tests of
``frontend/src/engine.test.ts`` and ``frontend/src/components/VerificationSummary.test.ts`` (node on a copy that links the real
``node_modules``, local-only) and the browser journey of ``frontend/e2e/workbench.spec.ts`` (a built copy served on port 4203
and Playwright, local-only)."""
from __future__ import annotations

from pathlib import Path

import pytest
from _engine_tools import browser_plant, edit_json, needs_browser, needs_web, py_plant, web_plant

FACTORY = pytest.TempPathFactory
MODEL = "tests/python/test_model.py::"
ENSEMBLE = "data-pipeline/aerovia_pipeline/ensemble.py"


def test_uq_001_a_lognormal_location_without_the_mean_correction_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    py_plant(tmp_path, tmp_path_factory, [(ENSEMBLE, "*sigma - .5*sigma*sigma)", "*sigma)")],
             [MODEL + "test_identical_seed_produces_identical_mean_one_resistance_draws"])


def test_uq_002_a_batch_with_misapplied_multipliers_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    py_plant(tmp_path, tmp_path_factory,
             [(ENSEMBLE, 'bi,forcing,effective=model["bi"],model["forcing"],resistance+model["k"]',
               'bi,forcing,effective=model["bi"],model["forcing"],resistance[:,::-1]+model["k"]')],
             [MODEL + "test_cpu_batch_agrees_with_independent_scipy_reference"])


def test_uq_003_a_sigma_floor_on_a_zero_variation_ensemble_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    py_plant(tmp_path, tmp_path_factory, [(ENSEMBLE, "sigma = math.sqrt(math.log1p(cv*cv))", "sigma = math.sqrt(math.log1p(cv*cv)) + 1e-3")],
             [MODEL + "test_zero_cv_ensemble_collapses_to_deterministic_solution"])


def test_uq_004_a_batch_that_reseeds_the_generator_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    # every batch of 256 draws its own block from a generator seeded again: the second batch repeats the first draws
    py_plant(tmp_path, tmp_path_factory,
             [(ENSEMBLE, "    draws=resistance_draws(model[\"r\"],samples,seed,cv)\n",
               "    draws=np.concatenate([resistance_draws(model[\"r\"],min(256,samples-s) if samples-s>=8 else 8,seed,cv)[:min(256,samples-s)] for s in range(0,samples,256)])\n")],
             [MODEL + "test_ensemble_batches_bound_memory_and_preserve_seeded_order"])


@needs_web
def test_uq_005_a_missing_reference_check_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, "src/engine.test.ts", [], ["requires all 96 independent GPU/SciPy resistance-draw checks"],
              mutate=lambda tree: edit_json(tree, "data/artifacts/reference-checks.json", lambda d: d["fixtures"].pop()))


@needs_web
def test_uq_006_a_summary_that_defaults_a_missing_failure_count_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    web_plant(tmp_path, tmp_path_factory, "src/components/VerificationSummary.test.ts",
              [("src/components/VerificationSummary.tsx", "const data = input as Record<string, unknown>;",
                "const data = { ensembleFailures: 0, ...(input as Record<string, unknown>) } as Record<string, unknown>;\n"
                "  for (const key of [\"maxMassResidual\", \"maxPressureResidual\", \"parityMaxAbsFlow\", \"referenceElapsedMs\", \"ensembleElapsedMs\", \"totalElapsedMs\"])\n"
                "    if (typeof data[key] === \"number\" && (data[key] as number) < 0) data[key] = 0;")],
              ["does not invent zero failures or successful residuals when fields are absent",
               "rejects non-finite and negative metrics while preserving legitimate failures for display"])


@needs_browser
@pytest.mark.full_plants
def test_uq_007_a_recorded_interval_kept_after_an_edit_is_caught(tmp_path: Path, tmp_path_factory: FACTORY) -> None:
    browser_plant(tmp_path, tmp_path_factory, "e2e/workbench.spec.ts",
                  "recorded uncertainty selects an airway and disappears when the operating inputs no longer match",
                  [("src/workbench/useWorkbench.ts", "const matchesBake =\n    !!network &&", "const matchesBake = true ||\n    !!network &&")])

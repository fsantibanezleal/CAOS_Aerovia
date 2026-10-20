# Requirements: Uncertainty: seeded resistance ensembles and their recorded evidence

The Uncertainty group of the App and the offline ensembles behind it (`data-pipeline/aerovia_pipeline/ensemble.py`): seeded lognormal resistance draws, the CPU and CUDA batches, the independent SciPy checks and the way the interface shows the recorded evidence. Written on 2026-10-20 after the code (retroactive).

EARS (Mavin et al., RE'09, doi:10.1109/RE.2009.9). Every requirement names the gate that fails when it is violated.

| ID | Requirement | Gate |
|---|---|---|
| UQ-001 | THE ensemble SHALL produce identical resistance draws for an identical seed, and THE draws SHALL have an arithmetic mean of one. | `tests/python/test_model.py::test_identical_seed_produces_identical_mean_one_resistance_draws` |
| UQ-002 | THE CPU batch SHALL agree with an independent SciPy solve of the same draws. | `tests/python/test_model.py::test_cpu_batch_agrees_with_independent_scipy_reference` |
| UQ-003 | WHERE the coefficient of variation is zero, THE ensemble SHALL collapse to the deterministic solution. | `tests/python/test_model.py::test_zero_cv_ensemble_collapses_to_deterministic_solution` |
| UQ-004 | THE ensemble SHALL bound its memory by batches and SHALL preserve the seeded order of the draws across batches. | `tests/python/test_model.py::test_ensemble_batches_bound_memory_and_preserve_seeded_order` |
| UQ-005 | THE committed reference checks SHALL hold all 96 independent same-draw checks. | `frontend/src/engine.test.ts::requires all 96 independent GPU/SciPy resistance-draw checks` |
| UQ-006 | THE verification summary SHALL derive from the baked benchmark, SHALL not invent zero failures or successful residuals when fields are absent, and SHALL reject a record of another case library, an inconsistent sample population, a non-finite metric or a negative metric. | `frontend/src/components/VerificationSummary.test.ts::derives the readable summary from the actual baked benchmark` and `frontend/src/components/VerificationSummary.test.ts::does not invent zero failures or successful residuals when fields are absent` and `frontend/src/components/VerificationSummary.test.ts::rejects a record for a different case library or inconsistent sample population` and `frontend/src/components/VerificationSummary.test.ts::rejects non-finite and negative metrics while preserving legitimate failures for display` |
| UQ-007 | WHEN the operating inputs no longer match the recorded ensemble, THE App SHALL withdraw the recorded interval instead of showing it for the changed inputs. | `frontend/e2e/workbench.spec.ts::recorded uncertainty selects an airway and disappears when the operating inputs no longer match` |

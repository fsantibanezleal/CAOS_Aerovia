# Design: seeded resistance ensembles and their recorded evidence

Written on 2026-10-20 from the code and the executed receipt, after the code (shipped in 0.02.000). The longer account is
[`docs/methods/uncertainty.md`](../../../methods/uncertainty.md) and [`docs/guides/03_gpu.md`](../../../guides/03_gpu.md).

- **The ensemble.** `data-pipeline/aerovia_pipeline/ensemble.py` draws independent lognormal resistance multipliers with an
  arithmetic mean of one (sigma from the coefficient of variation, 0.15 by default), 256 draws per case, from a seeded NumPy
  generator that the CPU and the CUDA batch share. Batches are float64 and bounded in size; failed draws are recorded, never
  dropped. Eight saved draws per case are solved again with SciPy on the identical vector.
- **The committed record.** `data/artifacts/catalog.json` holds the ensemble per case (3072 draws, no failures, device cuda) and
  `data/artifacts/reference-checks.json` the 96 matched checks; the receipt is
  [`docs/methods/execution-evidence.md`](../../../methods/execution-evidence.md).
- **In the App.** The Uncertainty group reads the recorded ensemble for the selected case; the interval is shown only while the
  operating inputs match the recorded ones (the match compares the serialised inputs), and an edit withdraws it. A new seeded
  experiment runs locally from an exported design.
- **Contracts and tests.** The `catalog` and `reference-checks` rows; `frontend/src/components/VerificationSummary.tsx`
  derives the readable summary and refuses an inconsistent record; the tests named in `requirements.md`.

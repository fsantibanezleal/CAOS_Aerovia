# Design: the two learned methods and their exports

Written on 2026-10-20 from the code, the committed artifacts and the learned-methods dossier, after the code (shipped in
0.02.000). The longer account is [`docs/methods/surrogates.md`](../../../methods/surrogates.md) and
[`docs/data-contract/learned-models.md`](../../../data-contract/learned-models.md).

- **Role.** The learned methods screen repeated parametric airflow cases. They are approximations of the exact solver, labelled
  by it, not measurements and not a faster solver by assumption; the exact solver stays available for every valid input.
- **Methods.** A topology-specific multilayer perceptron (two hidden layers of width 128) for each of the twelve networks, and
  one shared message-passing graph network (width 32, four steps) exported once per network (`docs/architecture.md`, section 6).
  Both predict a correction around a disclosed nominal calibration, then a fixed linear projection removes the internal flow
  imbalance and the pressures are reconstructed by least squares; raw and projected errors are both reported. Exact common-speed
  scaling is encoded for the supported zero-boundary setting rather than learned.
- **Pipeline.** `scripts/surrogates.py` and the `surrogate_*.py` modules of `data-pipeline/aerovia_pipeline/` separate
  ingestion, dataset generation (33,792 states in four splits, the seeds partitioned before any derived feature), features,
  training with resumable state, inference, evaluation, diagnostics, export and validation. Deployment never trains.
- **Exports and registry.** 24 ONNX graphs, 14 checkpoints, a registry, a model manifest, parity fixtures and a browser
  evidence record under `data/models/` (the catalog rows `model-registry`, `model-manifest`, `onnx-parity`, `model-io`,
  `checkpoint` and `browser-evidence`).
- **Browser lane.** `frontend/src/learned/index.ts` verifies each registered model path, size and digest before it opens an
  ONNX Runtime Web session (one CPU thread, one first-party WebAssembly runtime). `frontend/src/learned/domain.ts` decides the
  domain: a known topology and ordering, no closure, no curve edit, resistance ratios and speed in the trained range. Anything
  else returns an explicit refusal, and a finite prediction never sets the exact solver's converged flag.
- **Contracts and tests.** The six model rows of the catalog; the tests named in `requirements.md`.

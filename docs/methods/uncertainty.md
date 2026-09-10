# Reproducible resistance uncertainty

An ensemble answers a conditional question: how do the entered network's flows and electrical demand vary if each active airway resistance has independent lognormal uncertainty? It does not infer a probability distribution from field observations.

For entered resistance R, coefficient of variation c and independent standard normal draws Z:

```text
sigma = sqrt(log(1 + c²))
R_sample = R × exp(sigma × Z − sigma²/2)
```

The multiplier's mean is 1; its coefficient of variation is c. Draws use NumPy's `default_rng` with a recorded uint32 seed. The case library uses the requested seed plus the case index; the exact resulting seed is recorded for every case. Fixed fan coefficient, nominal fan pressure, area, targets and geometry do not vary. Imported network options are applied before sampling. A zero CV collapses to the deterministic result.

CPU and GPU consume exactly the same generated float64 resistance array. CUDA runs batched nonlinear solves using `torch.linalg.solve_ex` and per-sample backtracking. Each candidate must pass maximum absolute mass residual ≤1e−6 m³/s and pressure residual ≤1e−5 Pa and the supported fan regime. Failures, rejected sample indices and maximum residuals are recorded explicitly. A published artifact fails verification when any sample fails; local results are never silently promoted as a complete successful ensemble.

The persisted summaries contain sample count, accepted count, seed, CV, distribution, actual device, hardware, backend versions, dtype, iterations, elapsed time, per-edge p05/p50/p95 flow, target attainment fraction, and power p05/p50/p95. Percentiles use NumPy's linear quantile interpolation. The target fraction is the accepted-sample fraction whose signed flow meets that edge's positive entered target. An edge without a positive target reports 1 by convention; it is not a compliance claim. At 256 samples the frequency resolution is 1/256; rare-event estimates are outside the intended interpretation.

Eight evenly spaced sample indices per case are re-solved by independent SciPy `least_squares`. Their resistance overrides and full reference outputs are committed in `reference-checks.json`. `parityMaxAbsFlow` measures maximum absolute branch-flow disagreement in m³/s, with a release limit of 1e−4. This is cross-implementation verification, not statistical convergence or field validation.

Use `python scripts/pipeline.py bake --device cuda --samples 256 --cv 0.15 --seed 20260909 --input data/cases.json --output build/local/gpu` in the CUDA environment. The CPU alternative changes `--device cpu` and needs only `requirements.txt`. Use `--input your-network.json` for additional networks. CUDA availability is checked explicitly; there is no fallback that labels CPU work as GPU execution.

The baked ensemble corresponds exactly to its stored options. Browser edits do not recompute the GPU artifact. Use a new offline bake for uncertainty of changed resistance, targets, topology or fan settings. The browser's deterministic edits and locally baked uncertainty are separate calculations and must be labeled accordingly.

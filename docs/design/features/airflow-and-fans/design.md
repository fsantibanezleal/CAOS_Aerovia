# Design: the exact steady solver and its analyses

Written on 2026-10-20 from the code, after it (the solver and its analyses shipped in 0.02.000; the Airflow group merges the
old flow and operations modes in this release). The longer account is [`docs/engine/README.md`](../../../engine/README.md) and
[`docs/methods/ventilation-model.md`](../../../methods/ventilation-model.md).

- **The model.** Signed quadratic airway resistance, a monotone fan curve, fixed boundary pressures, constant density and
  isothermal air, in SI units: `p_from - p_to + H0 s^2 = (R + k) Q |Q|` per airway and zero net flow at every internal
  junction (`docs/architecture.md`, section 1).
- **The browser solver.** `frontend/src/engine/solver.ts` solves nodal pressure by damped Newton continuation (the
  continuation stages run from 1e-2 down to 0, at most 50 iterations per stage and 240 in all) and then checks the original
  equations. An accepted solve has an internal imbalance of at most `MASS_TOLERANCE` (1e-6 m3/s) and a branch pressure residual
  of at most `PRESSURE_TOLERANCE` (1e-5 Pa). `frontend/src/engine/validation.ts` holds the input checks and `LIMITS` (120
  junctions, 240 airways, a 2 MiB file, a maximum common speed of 1.5). It runs in a module worker
  (`frontend/src/engine/worker.ts`, driven by `frontend/src/useEngine.ts`).
- **The analyses.** `frontend/src/engine/analysis.ts`: the lowest common fan speed in the range 0 to 1.5 by bisection over
  converged solves (equal boundary pressures required), a 21-point speed sweep from actual solutions, and a one-at-a-time
  resistance perturbation of 5 percent. The group's sub-views are Flow and paths, Fan duty, Conditions, Equipment, Result and
  Display; fan speed and resistance scale live in the rail.
- **The offline reference.** `data-pipeline/aerovia_pipeline/model.py` solves the same equations with SciPy least squares
  (trust-region reflective, analytical Jacobian, float64). It is the baseline provider of the two model slots.
- **Contracts and tests.** The `engine-worker` row of the catalog; the tests named in `requirements.md`.

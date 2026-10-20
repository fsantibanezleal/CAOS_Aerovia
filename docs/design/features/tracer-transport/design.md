# Design: conservative passive transport and directed routes

Written on 2026-10-20 from the code and the transport dossier, after the code (shipped in 0.02.000). The longer account is
[`docs/methods/transport.md`](../../../methods/transport.md) and [`docs/methods/routing.md`](../../../methods/routing.md).

- **The model.** Each airway is divided into equal mixed cells; a cell passes tracer downstream at the actual branch flow
  (`|Q| C` upstream), a junction has no storage and mixes incoming flux into outgoing airways in proportion to their flow, and a
  pressure boundary is a clean external reservoir. Each cell obeys `dm/dt = in - out + source - lambda m`. The scheme is
  first-order upwind in space (numerical dispersion, so the cell count is exposed) and the two-stage strong-stability-preserving
  Runge-Kutta update in time, with the step bound `dt (|Q|/V + lambda) <= 0.45`.
- **Operation.** Releases are pulses (mg) or finite constant sources (mg/s) at a fraction of the airway from its original
  `from` endpoint. A schedule is a sorted list of complete operating states; each change re-solves the quasi-steady airflow and
  keeps the tracer. Integration segments align with output times, releases and flow changes. Area changes inside a schedule are
  refused. Every frame reports injected, stored, escaped and removed mass and the balance error.
- **Limits.** `TRANSPORT_LIMITS` in `frontend/src/engine/transport.ts`: 16 cells per airway, 301 frames, 32 releases, 24
  changes, 86,400 s, 200,000 steps, 40 million cell steps. The defaults are 6 cells and 121 frames. A workload over a limit is
  rejected with an actionable message, never coarsened.
- **Routes.** `frontend/src/engine/routing.ts` weights each airway by nominal volume over the solved flow, a residence-time
  proxy, orients airways by the solved sign, stops at pressure boundaries, leaves closed and stagnant airways without a finite
  time, and reports strongly connected components as recirculation. It is not the earliest tracer arrival nor human access.
- **Lane.** The integrator runs in a cancellable worker (`frontend/src/workbench/transport.worker.ts`, driven by
  `frontend/src/workbench/useTransport.ts`); `scripts/transport.mts` runs the same code from the command line.
- **Contracts and tests.** The `transport` row of the catalog; the tests named in `requirements.md`.

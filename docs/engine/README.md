# Browser numerical engine

The browser engine solves steady, constant-density airflow through a directed ventilation network. The public TypeScript entry point is `frontend/src/engine/index.ts`; the independent offline implementation is described in [the processing guide](../guides/02_processing.md) and [GPU guide](../guides/03_gpu.md). All input values use SI units. The engine has no runtime numerical dependency and runs in a module Web Worker, so graph operations do not block viewport interaction.

## Governing equations and signs

For an open branch from node `u` to node `v`, positive volume flow `Q` follows that direction:

```text
p[u] - p[v] + H0 s² = (R + k) Q |Q|
sum(outgoing Q) - sum(incoming Q) = 0   at every internal node
H_delivered = H0 s² - k Q |Q|
P_electric = H_delivered Q / efficiency
```

`R` is airway resistance in Pa/(m³/s)², `H0` is fan shutoff pressure in Pa at unit speed, `k` is the quadratic fan coefficient in Pa/(m³/s)², and `s` is the common fan-speed factor. Passive airways have `H0 = k = 0`. A node with `boundary` has fixed pressure in Pa and can exchange air with the surroundings. Other nodes enforce exact mass continuity for constant density. Coordinate units are metres and affect the visualization; coordinates do not silently create an airway resistance model.

The fan law is supported only for forward flow and nonnegative delivered pressure. Reverse flow or negative forward delivery produces `converged: false` with the fan identifiers. A mathematical root alone does not imply supported fan operation. Fan electrical power sums positive, supported delivery divided by entered efficiency, converted to kW. The small comparison tolerances are 1e-6 m³/s and 1e-5 Pa; no efficiency or power is invented for unsupported operation.

## Numerical method

The solver eliminates branch flow using the signed square root of branch pressure drop. Newton updates solve the grounded weighted graph Laplacian. Diagonal equilibration reduces units and coefficient conditioning effects; Gaussian elimination uses partial pivoting. Pressure and flow are nondimensionalized with a source/boundary pressure scale and the median effective branch resistance.

The inverse-square-root derivative is singular at zero pressure drop. A continuation sequence uses the smooth, monotone flow function

```text
q(h, epsilon) = h / [sqrt(r) (h² + epsilon²)^(1/4)]
epsilon = 1e-2, 1e-4, 1e-6, 1e-8, 1e-10, 1e-12, 0
```

in dimensionless pressure units. Each Newton direction is damped by a backtracking check of residual decrease or convex energy decrease. The sequence ends with the exact signed square root. The engine then recomputes maximum internal mass imbalance and maximum open-branch pressure-equation error in SI units. Acceptance requires mass error at most **1e-6 m³/s** and pressure error at most **1e-5 Pa**, finite numerical values, and supported fan operation. The iteration budget is 240 Newton iterations, at most 50 per continuation stage. Ill conditioning and nonconvergence are explicit failed results.

`iterations` counts attempted Newton directions across continuation stages. `elapsedMs` measures computation in the running browser and is not portable benchmark evidence. Closed branches have exactly zero flow and contribute no constitutive equation. Their entered targets remain active, so closing a targeted airway cannot create compliance. If closures remove every path from any internal node to a fixed-pressure boundary, the engine returns a failed result before solving; zero residual placeholders in that result mean **not evaluated**, as its message states. The interface must always gate numerical interpretation on `converged`.

## Result metrics

| Field | Definition |
| --- | --- |
| `flows` | Signed m³/s, in input edge order |
| `pressures` | Pa, in input node order |
| `velocities` | Signed `Q / area`, m/s, in input edge order |
| `fanPowerKW` | Sum of positive supported fan electrical demand, kW |
| `totalIntake` | Sum of positive **net** outward boundary-node flows, m³/s; internal circulation is not double-counted |
| `targetRatio` | Minimum signed `Q / target` over positive targets; 1 when no positive targets exist |
| `shortfalls` | `max(0, target - Q)` in input edge order, m³/s |
| `massResidual` | Maximum absolute internal-node mass imbalance, m³/s |
| `pressureResidual` | Maximum absolute open-branch pressure-equation error, Pa |

An area override changes velocity. Resistance remains a separate input; this model does not infer a resistance change from cross-sectional area without explicit geometric/friction assumptions. The global resistance multiplier applies to airway `R`, including a fan airway's friction, and does not multiply its fan curve coefficient `k`. An absolute edge resistance override is applied before the global multiplier.

## Interactive analysis

`optimizeSpeed(network, options)` finds the lowest common speed within `[0, 1.5]` satisfying all positive signed branch targets. It checks the maximum setting first and then maintains a feasible upper bracket through 26 bisection evaluations. The zero-target case returns zero speed. With equal fixed boundary pressures, quadratic flow equations scale homogeneously (`Q ∝ s`, pressure differences `∝ s²`, fan power `∝ s³`), which justifies monotonic target feasibility for supported forward targets. The result is a **single common control optimum**, not a global optimization of independent fans, regulators or topology. Unequal imposed boundary pressures receive an explicit unsupported-optimization message, since monotonic target delivery is not guaranteed. A failed optimization must not silently overwrite the current operating setting.

`sensitivity(network, options)` perturbs each open branch resistance upward by 5% and resolves the entire network. `elasticity` is the fractional change of the minimum target ratio divided by 0.05; it is a finite intervention measure of the current bottleneck and can switch controlling branch. At zero bottleneck ratio or when no targets exist, elasticity is reported as zero because relative target elasticity is undefined. `powerDelta` is the absolute electrical-demand change in kW; `flowDelta` is the absolute total-intake change in m³/s. Rows sort by absolute elasticity. A nonconverged baseline or perturbation produces an error, not fabricated analysis. This is one-at-a-time sensitivity, not probabilistic uncertainty.

`curve(network, options)` solves 21 common-speed points from 0 through 1.5 inclusive. Each point contains total intake, total electrical power, minimum target ratio, and volume-flow-weighted fan delivered pressure. It reports a network operating sweep rather than the isolated manufacturer's fan curve. All sweeps retain the chosen overrides and airway resistance multiplier. If a point is unsupported or nonconvergent, the analysis returns an error identifying that speed.

## Worker contract

```ts
const worker = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' })
worker.postMessage({ id: 1, kind: 'solve', network, options })
// Response: { id: 1, kind: 'solve', result } or { id: 1, kind: 'solve', error }
```

The supported kinds are `solve`, `optimize`, `sensitivity`, and `curve`. Every response preserves the request ID. Consumers should discard responses from obsolete requests and terminate obsolete workers when cancelling expensive sweeps. Validation errors return readable messages. Import is local; these functions neither upload nor persist user data.

## Validation and model boundaries

Run `npm test` from `frontend`. Tests exercise closed-form series and parallel systems, zero source, passive pressure-driven flow, sign orientation, fan cube laws, dead ends, symmetric zero-flow bridges, energy balance, pressure-offset invariance, closure isolation, unsupported fan operation, target feasibility, resistance sensitivity, worker dispatch, JSON round-trips, the full authored case matrix and a connected network at the 120-node/240-edge limit. Strict parity tests cover all twelve independent SciPy case solutions: maximum permitted differences are 2e-6 m³/s in branch flow, 1e-4 Pa in node pressure and 1e-5 kW in electrical demand. Missing reference artifacts fail the test suite. Tests prefer the published `data/artifacts/catalog.json` and accept a fresh local `build/local/reference/catalog.json` during pipeline development. The independent SciPy reference and CUDA uncertainty checks are separate implementations rather than alternate calls to this JavaScript engine.

These are verification tests for the specified equations. The included cases are authored engineering scenarios and have not been calibrated against a surveyed operating mine. This release excludes temperature, buoyancy/natural ventilation, compressibility, gas chemistry, fire, transient airflow, fan stall dynamics and independently controlled multi-fan optimization. Flow targets are user-entered engineering constraints; meeting them is not a substitute for a mine's ventilation design and operating procedures.

The physical formulation follows [McPherson, *Subsurface Ventilation Engineering*, chapters 5, 7 and 10](https://www.srk.com/download/file/594). The book is linked as a reference, not redistributed. Related implementation evidence and alternative software boundaries are recorded in the research and architecture documentation.

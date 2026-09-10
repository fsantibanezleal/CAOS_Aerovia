# Ventilation equations and numerical verification

Aerovia solves a steady, isothermal network with constant density represented by the entered airway resistance. It supports pressure/flow distribution, electrical fan demand and comparisons against user-entered targets. It does not calculate heat, gas chemistry, fire, compressibility, natural ventilation pressure, fan transients, mine safety approval or direct equipment control. Authored cases have no field calibration.

## Signed physical model

An edge is directed from `from` to `to`. Positive flow follows that direction; passive edges can reverse. For each active airway:

```text
p_from - p_to + H0 × s² - k × Q × |Q| = R × Q × |Q|
```

Pressure is Pa, flow Q is m³/s, speed s is a fraction of the supplied fan curve's nominal speed, area is m², and resistance R and fan coefficient k are Pa·s²/m⁶. Nonfan edges have H0=k=0. R must remain strictly positive. Junction incidence B uses +1 at `from` and −1 at `to`; all internal nodes satisfy `B_internal Q = 0`. Boundary nodes retain their supplied pressure exactly. Every node must have an undirected open path to a boundary. Removing an edge cannot silently introduce a fabricated pressure anchor.

The signed quadratic fan extension is used in the solver equations. A fan solution with Q < −1e−7 m³/s or delivered H < −1e−6 Pa is outside the supported fan regime and reports `converged=false`. It is not presented as an accepted reverse-running or stalled-fan operating point.

Area and resistance are independent entered quantities. Editing area changes velocity Q/area; it does not recompute R. To model an excavation or obstruction, enter the measured/estimated changed R explicitly. Coordinates define the displayed centerline and its straight-segment length, used by tracer transport and routing for represented volume and nominal travel time. They do not establish measured airway length or calibrate resistance; a curved passage needs intermediate junctions or an explicitly supplied transport length. A geometry-based Atkinson resistance requires a chosen friction factor, perimeter, length and operating density outside this release's direct inputs. See [transport](transport.md) and [routing](routing.md) for their separate assumptions.

## Independent algorithms

The browser implements nodal-pressure Newton iteration with smooth continuation, then checks the exact signed square-law residual. The offline reference independently uses SciPy `least_squares(method='trf')` on simultaneous unknown edge flows and internal pressures with an analytical Jacobian. Its normalized residual concatenates internal flow balance and branch energy closure. Trust-region stopping status alone is insufficient: the exported physical residuals must pass independently.

The reference unknowns are Q/Qscale and p/Pscale. Pscale is at least 100 Pa and tracks the largest forcing magnitude. Qscale is at least 10 m³/s and is based on Pscale and the median effective resistance. A least-squares solution of a linear resistance approximation initializes the trust-region solve. SciPy tolerances are 1e−13, with at most 1500 function evaluations. Physical release acceptance is maximum absolute internal mass residual ≤1e−6 m³/s and maximum absolute branch pressure residual ≤1e−5 Pa. These are absolute SI tolerances, not percentages of plotted quantities.

GPU uncertainty uses batched mixed-variable damped Newton equations in PyTorch float64 on CUDA. Its independent CPU verification uses the SciPy reference on eight identical saved resistance draws per case. In this uncertainty stage, no learned model is trained or substituted for the network equations. The separately documented [surrogate pipeline](surrogates.md) trains and evaluates approximations against numerical reference outputs; it does not replace the uncertainty solver or its reference checks. A CPU-only uncertainty batch path uses NumPy with the same Newton equations; it requires no PyTorch installation.

## Quantities and operations

Electrical fan power is `max(H,0) × max(Q,0) / (efficiency × 1000)` kW, summed over fans. It includes the entered fan efficiency; motor/VFD efficiency is not represented separately. Multiplying by user-entered operating hours gives kWh; multiplying by tariff gives cost in the user's tariff units. These are scenario calculations, not measured savings.

`totalIntake` is the sum of positive net boundary supply. A pressure boundary's net outgoing signed branch flow is clamped at zero before summing; this avoids double-counting internal intake galleries. `targetRatio` is the minimum signed Q/target among all positive targets, with 1 for no targets. `shortfalls[e] = max(0,target[e] − Q[e])`. A reversed branch does not satisfy a positive forward-flow target. A closed target branch retains its deficit and has zero flow and velocity.

The browser's speed search is bounded to [0,1.5] and changes every fan by the same scalar. It requires equal fixed boundary pressures, which preserves homogeneous flow scaling with common speed. Unequal imposed pressures can make target delivery non-monotone; that search is rejected with an explicit explanation, while the general network solver and speed-curve inspection remain available within their supported fan regime. The search finds the least feasible common speed for the entered targets; it does not optimize independent fans, regulator topology or excavation. Resistance sensitivity holds other inputs fixed. These operations should be compared using the same imported network, baseline, target assumptions and electrical tariff.

## Verification evidence

Run `python -m pytest tests/python -q` after installing CPU requirements. Tests establish exact series and parallel analytic flows, fixed-pressure translation, passive orientation invariance, zero forcing, fan affinity scaling, closure/disconnection behavior, malformed input rejection, all 12 authored networks at four speeds, and CPU batch/SciPy parity. Artifact verification recomputes conservation from exported arrays and checks SHA-256 identities.

Browser/SciPy and CUDA/SciPy agreement establishes implementation consistency. It does not establish accuracy against an operating mine. The checked-in `data/artifacts/catalog.json` records actual device, versions, timings and residuals. `data/artifacts/reference-checks.json` stores the sampled resistances as overrides and the independent reference answers, so another implementation can reproduce the comparison.

## Primary sources

- [SRK: Subsurface Ventilation Engineering by Malcolm J. McPherson](https://www.srk.com/en/products/ventilation-textbook), especially chapters 5, 7 and 10. The book is linked rather than redistributed; free access is not treated as a redistribution license.
- [SciPy least_squares reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html), the independent offline trust-region implementation.
- [PyTorch batched linear solve](https://docs.pytorch.org/docs/stable/generated/torch.linalg.solve.html), the local CUDA batch primitive.
- [NIOSH MFIRE](https://www.cdc.gov/niosh/mining/tools/mfire.html), context for the materially broader coupled fire/contaminant simulation domain. Aerovia does not claim MFIRE validation or feature equivalence.

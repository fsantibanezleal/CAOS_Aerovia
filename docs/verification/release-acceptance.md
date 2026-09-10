# Release acceptance: 0.01.000

This record distinguishes implemented engineering workflows, numerical verification, rendered inspection
and public deployment identity. The model and case provenance remain explicit in the workbench and
[physical model](../methods/ventilation-model.md).

## Implemented workflows

The spatial workbench supports all twelve authored cases and validated imported networks. The scene,
inspector, target delivery, results table and analysis share the same validated input/result pair.
Common fan speed, global/branch resistance, area, targets and closures recalculate the network in a
worker. Baselines, undo/redo, device recovery, JSON project round trips and CSV exports are exercised.
Sensitivity ranking selects its corresponding airway; minimum-speed results require an explicit Apply.

The three browser suites exercise ordinary workflows, scientific failure boundaries and presentation:

- `workbench.spec.ts`: controls, actual numerical change, all twelve cases, baseline/history/recovery,
  optimization, curves, sensitivity, import/export, both themes, language navigation and mobile panels.
- `scientific-boundaries.spec.ts`: supported calculation versus unsupported optimization, exact-input
  ensemble invalidation, conditional sample frequencies, zero-speed and closed-fan explanations.
- `presentation.spec.ts`: every Evidence subtab and computed Analysis panel in EN/ES and both themes;
  desktop/mobile architecture, Escape, focus restoration and explicit keyboard focus cycling.

Automated viewport checks supplement actual screenshot review. The review covered desktop spatial
geometry, light-theme contrast, mobile camera framing, fan/system and speed-sweep charts, sensitivity,
uncertainty intervals, numerical evidence and the architecture dialog. CI retains its browser report
and screenshots as `browser-verification-evidence` for fourteen days. The repository contains a
[representative workbench capture](../assets/workbench.png); every capture can be reproduced by the tests.

## Correctness and data boundary

The browser suite is separate from 188 numerical, analysis, verification-record and storage unit tests.
The Python suite verifies reference physics, validation, ensemble parity, acquisition, corruption
detection and transactional output. Exact execution statistics are in the
[canonical evidence](../methods/execution-evidence.md), with original inputs and checksum manifests.

Review fixed stale arrays during rapid case switches, unsupported-search infeasibility wording,
closed-fan pressure claims, rounded conditional probabilities, mobile navigation names and modal focus.
A model that cannot converge does not produce successful result metrics. Changing a case invalidates
unrelated results; changing baked inputs invalidates their uncertainty match. Imported baseline result
arrays are ignored and recomputed from validated inputs.

## Measured local interaction

A fresh headless Chromium 153 session at 1440 by 1000 on 2026-09-10 UTC loaded the development workbench
and solved its initial case in 712 ms. Twelve real speed-control interactions, including automation and
the input debounce, had a 348 ms median and 573 ms 95th-percentile completion time. Across 120 animation
callbacks, median and 95th-percentile requestAnimationFrame cadence were 16.7 ms. This is a measured
local browser session, not a GPU throughput guarantee, network-performance guarantee or industrial-size
benchmark. Only the workbench's own origin was requested; no page errors were observed.

## Publication verification

A release is complete only after the exact main revision passes CI, deploys at
<https://aerovia.fasl-work.com/>, and passes HTTPS/asset identity and fresh public browser checks.
`frontend/verify-deployment.mjs` verifies all manifest-listed runtime bytes against their hashes and
expected source revision. The daily `Verify live Aerovia` workflow repeats identity and browser checks.
The [deployment guide](../guides/04_deployment.md) documents reproduction and rollback.

These checks establish the supported software behavior and published artifact. They do not establish
field calibration, mine-specific applicability, customer adoption or measured operational savings.

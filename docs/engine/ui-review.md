# Independent functional UI review

Review date: **2026-09-09, America/Santiago**. The engine/storage implementer independently exercised the running application with Playwright 1.63 and Chromium at `http://127.0.0.1:5908`. Desktop viewport: **1440 × 1000**. Mobile viewport: **390 × 844**, touch enabled. Fresh browser contexts isolated each scenario from previous local projects. This record covers the local running product; deployment verification is a separate release check.

## Numerical behavior observed through the interface

| Interaction | Observed behavior |
| --- | --- |
| Default three-level production | 222.4 m³/s intake, 801.9 kW electrical demand; balanced network |
| Fan speed from 1 to 0.5 | 111.2 m³/s and 100.2 kW, matching half flow and one-eighth power at the displayed precision |
| Global resistance from 1 to 2 at half speed | Intake decreases to 82.4 m³/s and demand to 81.6 kW |
| Save baseline, then halve speed | Inspector reports the selected working's signed change of -15.58 m³/s; spatial baseline coloring becomes selectable |
| Close main fan and first intake shaft | Explicit isolation error identifies affected nodes; status changes to “Check model”; numerical KPI values are suppressed |
| Restore case and optimize | Feasible speed approximately 1.419 times nominal, 2,291.5 kW, 28 evaluations |
| Apply optimized setting | All 12 positive flow targets are met; weakest target displays 100% |
| Operating envelope | Actual fan/system operating-point plot and common-speed electrical-demand/target-delivery plots render |
| Resistance sensitivity | Twelve highest-impact branches render; the initial controlling working has approximately -0.325 elasticity for the +5% perturbation |
| Mobile keyboard adjustment | One decrement changes speed to 0.99 and demand to 778.1 kW |

All twelve authored cases were selected sequentially in the actual application and finished with “Network balanced.” A subsequent stress sequence made **24 case changes without waiting for intermediate solutions**; the final selected case rendered correctly with a balanced result and no console/page errors. This checks both node/edge-count changes and stale worker response handling.

## Persistence, import and interaction

- Malformed network JSON is rejected with a specific validation error and leaves the current solved project unchanged. The observed 2,291.5 kW result remained intact. Escape closes the import dialog.
- A project exported at speed 0.6 and global resistance 1.5 retained those values and its baseline inputs. The downloaded project contained no `baseline.result` field.
- Importing that project restored both controls and a recomputed baseline. Reloading the page restored the same settings and a balanced result from local storage.
- The selected-airway list changes the inspector and exposes fan-specific controls when a fan is selected. Mobile controls and inspector drawers remain usable.
- Keyboard Enter toggles the flow-animation control; the label changes between play and pause. Spanish text, the document language and dark theme update in the active workspace.
- The mobile results table uses a local horizontal scroll area (585 px content in a 354 px container). Workspace, analysis, evidence and verification keep the overall document at exactly 390 px wide.
- Evidence content was checked for unrendered placeholders such as `undefined`, `[object Object]`, lorem ipsum and “coming soon”; none were observed.

## Defects found and verified fixes

| Finding | Correction and verification |
| --- | --- |
| Switching from a smaller to a larger network used stale flow arrays for one render and produced NaN Three.js geometry | Result acceptance now associates inputs and output. Repeating all cases and the 24-change stress sequence produced no geometry warnings. |
| Switching from a larger to a smaller network could dereference an absent edge in target counting and replace the app with its error boundary | Target counting is guarded and current results are associated with their input generation. The original hard-rock → deep-five-level → room-pillar reproduction now passes. |
| Icon-only mobile navigation lost accessible names because its text spans were hidden | Every navigation button now has an explicit localized accessible name; mobile role-based navigation succeeds. |
| The initial portrait camera clipped important network geometry | Aspect-aware framing was added and visually inspected; the main connected network is visible at the reviewed mobile viewport. The airway list remains the exact selection alternative for small projected labels. |
| A closed fan still appeared to deliver pressure in the fan plot | Closed fans are excluded from operating-point selection. Closing all fan branches shows a specific closed-state explanation and no active fan plot. |
| A single stopped fan was incorrectly described as multiple pressure sources | Zero-speed, zero-flow, unequal-boundary and multiple-active-fan reasons are now distinct. Browser verification at speed zero shows zero flow/power and the stopped-state explanation. |
| Clamping negative fan head could draw a fabricated flat tail beyond free delivery | The plotted domain ends at the nonnegative-head free-delivery limit. Tests verify that all earlier points have positive head and no points exceed the limit. |
| Verification opened with an unstructured raw JSON dump | Validated, readable conservation, ensemble, reference-agreement and execution-time cards are now primary. The real raw record remains available in a collapsed details element. |

The verification cards were checked at both viewports against the actual baked record: 12 cases, 509 junctions, 656 airways, 3,072 resistance draws, 96 independent batch/reference checks, zero rejected draws and a maximum batch/reference branch-flow difference of approximately 1.18e-11 m³/s. The raw record is initially hidden. Missing/inconsistent records do not create inferred successful statistics.

## Verification scope and evidence

The reviewed final workflows produced **zero browser console errors and zero uncaught page errors**. The numerical, project-storage, fan-state and benchmark-interpretation unit suites contained **188 passing tests** at this review, and TypeScript checking passed. The separately maintained Playwright release suite covers production-build regressions.

Temporary screenshots were inspected in `frontend/test-results/`, including desktop baseline/analysis, the original case-switch failure and corrected state, mobile workspace/controls/inspector/table/evidence, and both viewport verification summaries. Those runtime images are intentionally ignored build artifacts; this report preserves the reproducible interactions and findings. The authored cases and their numerical agreement establish behavior of the specified model, not calibration against an operating mine.

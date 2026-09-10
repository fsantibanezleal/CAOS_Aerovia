# Independent functional UI review

## Shared-shell rebuild, 2026-09-10

This section supersedes the earlier interface review below. The previous custom-panel interface was rejected and has been replaced by the shared CAOS shell and a directly editable spatial workspace. This is a local validation record, not a statement that production promotion has completed or that the user has accepted the redesign.

The rebuilt Playwright suite contains **25 real-browser workflows** across `frontend/e2e/workbench.spec.ts`, `scientific-boundaries.spec.ts` and `presentation.spec.ts`. It uses the running app, real file uploads/downloads and actual Web Workers and ONNX WASM inference. It does not mock results or inject application state. Chromium runs at 1440 × 1000 and 390 × 844, with fresh contexts for independent scenarios. The full local suite passed in approximately 1.1 minutes; TypeScript checking and all **312 unit tests** also passed.

| Workflow | Evidence checked |
|---|---|
| Create, draw, connect, move, fan, split | The downloaded network changes node/edge counts, identities, coordinates and fan equipment; undo/redo restores the exact network. |
| Pointer editing | Orbit changes only projected labels. Dragging a real transform axis commits changed physical coordinates into the downloaded project; undo restores the original coordinates. |
| JSON and two-table CSV ingestion | Invalid JSON, bad joins and malformed mappings leave the current network and options intact. Independent junction/airway uploads convert feet to SI and preserve bilingual names on CSV export. |
| Persistence | A saved project reloads with the exact edited network/options. Mobile theme/language changes and focus mode preserve the engineering state. |
| Flow and fan controls | An analytical 100 Pa fan against unit resistance produces 10 m³/s. Half speed gives 5 m³/s. Closure stops flow, and reopening restores it. |
| Optimization and intervention ranking | The computed operating point is explicitly applied and meets all 12 supplied targets. A speed sweep renders actual calculations, and selecting a ranked intervention selects that same airway in the spatial readout. An unsupported unequal-boundary search reports its actual limitation rather than a false infeasibility verdict. |
| Energy and cost | With analytical power 1.25 kW, 8000 h/year and tariff 0.2, the display gives 10 MWh and 2000 annual cost. Half speed gives 1.25 MWh, cost 250 and baseline change −1750. Zero hours produces zero energy/cost. |
| Level isolation | A hidden working passage cannot be selected by an actual canvas ray pick. Restoring all levels restores its selection. Exported hydraulics and solved flow remain unchanged. |
| Pulse, continuous and scheduled transport | Every exported frame conserves injected = stored + escaped + removed mass, with nonnegative finite cell concentrations. Pulse mass doubles linearly; a scheduled fan stop traps remaining tracer and the scrubbed flow corresponds to the selected time. A continuous source injects its exact finite mass. Invalid release timing gives a repairable error. |
| Reproducible transport export | The replay file carries network, options, request and result. Re-executing the exported inputs with the engine reproduces every concentration and ledger frame exactly. |
| Recorded uncertainty | Four plotted traces select the corresponding airway. Its displayed median agrees with the actual catalog artifact. Edited operating inputs remove unsupported baked intervals; an explicit canonical reset restores them. |
| Learned screening | Both exported models execute in WASM. A selected predicted field is labeled as an approximation; switching back restores the numerical field. Importing an uncalibrated topology clears the prediction and produces an explicit domain rejection. |
| Benchmark | The exact browser calculation agrees with the recorded same-input reference below 1e-5 m³/s. Held-out reference plus both learned models execute, render actual comparisons and expose airway values. |
| Shell and content | All six routes and every content tab render in EN/ES and light/dark without document overflow or equation errors. All five architecture diagrams fit; mobile native-size mode scrolls inside its container. Keyboard focus remains inside the modal, and Escape restores its opener. |

The tests found and drove correction of five concrete regressions: mobile Load/Save buttons lost their accessible names when text was hidden; a transform-control event ordering error updated only the movement preview; a stale predicted result could be paired with a newly imported topology and crash the workspace; the shared architecture modal allowed Tab to reach background controls; mapped scientific-diagram nodes emitted a missing-key React error. The tests retain those reproductions. An automatic fixture rejects browser `console.error` and uncaught page errors in every workflow.

Shared-shell **0.6.7** carries the focus/native-diagram fix upstream. It passed 36 package tests and eight standalone Chromium combinations (mobile/desktop × EN/ES × light/dark), was promoted through PRs #24 and #25, and was published from main `fed727a07a246311c52eabc0a7b909c88f574b77`. A fresh public npm tarball had SHA-1 `aa227c55f6910a648283c85464ae993ef15365d7`, matching registry metadata. Aerovia installed that version before the subsequent navigation patch. The former Lucide 1.x import fix is in 0.6.6.

The subsequent screenshot review found that the shared header hid companion-route navigation below 760 px. Shared-shell **0.6.8**, now pinned by Aerovia, restores the same links in a compact second row with contained horizontal scrolling and automatic visibility on keyboard focus. Twelve additional standalone browser combinations visit all six routes by mouse and keyboard at 320/390/1440 px in both languages/themes; the header stays below 100 px and the main surface retains over 65% of viewport height. PRs #27/#28 promoted main `750489eeb142d04fa47affd1e8214d09184493ec`; the fresh public tarball SHA-1 is `f753928d8cdaa355d759fdb470a4f7b37b04fe0b`. The app mobile journey now visits every companion route and verifies that returning restores the engineering options.

In the actual application at 390 × 844, the two-row header measures 73.61 px, the main surface 692.84 px and the design canvas 373 px high; the document stays exactly 390 × 844. At 1440 × 844, the header remains 57 px and the main surface measures 756.23 px. The project action strip and visual controls scroll within their own containers; the mobile save button is reachable and its downloaded engineering state survives navigation.

Run local browser validation with `AEROVIA_TEST_URL` pointing to the running frontend and `npx playwright test`; omit that variable to test the configured production preview after `npm run build`. The test code has its own strict type-check configuration: `npx tsc --noEmit -p e2e/tsconfig.json`. Screenshots and traces are ignored runtime artifacts under `frontend/test-results/`. The authored networks and synthetic perturbations establish software/model behavior, not validation against measured mine operations.

## Archived review of the previous interface

Historical v0.01.000 verification. The user rejected that interface; this record does not establish acceptance of the rebuilt product. Current rebuild evidence is recorded in [the 0.02.000 review](../verification/rebuild-0.02.000.md).

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

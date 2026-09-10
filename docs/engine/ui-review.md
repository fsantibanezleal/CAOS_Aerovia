# Independent functional UI review

## Shared-shell rebuild, 2026-09-10

This section supersedes the earlier interface review below. The previous custom-panel interface was rejected and has been replaced by the shared CAOS shell and a directly editable spatial workspace. This is a local validation record, not a statement that production promotion has completed or that the user has accepted the redesign.

The rebuilt Playwright suite contains **34 real-browser workflows** across `frontend/e2e/workbench.spec.ts`, `scientific-boundaries.spec.ts` and `presentation.spec.ts`. It uses the running app, real file uploads/downloads and actual Web Workers and ONNX WASM inference. It does not mock results or inject application state. Chromium uses fresh contexts at 1440 × 1000 and 390 × 844 for functional work, and the exact ADR-0071 sizes 1280 × 800, 1600 × 900 and 2560 × 1440 for layout gates. The final combined **34-workflow suite passed in 3.1 minutes**, including all 26 functional workflows and eight new layout/focus workflows, with zero console or uncaught page errors. Strict application and E2E TypeScript checking and all **312 unit tests** pass.

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
| Recorded uncertainty | Mobile selected P05/P50/P95, target probability and fan-power intervals match the actual ensemble in both languages. Four plotted traces select the corresponding airway. Its displayed median agrees with the actual catalog artifact. Edited operating inputs remove unsupported baked intervals; an explicit canonical reset restores them. |
| Learned screening | Both exported models execute in WASM. Selected-result flow and physical residuals agree with the displayed approximation, independently checked for both methods. A selected predicted field is labeled as an approximation; switching back restores the numerical field. Importing an uncalibrated topology clears the prediction and produces an explicit domain rejection. |
| Benchmark | The exact browser calculation agrees with the recorded same-input reference below 1e-5 m³/s. Held-out reference plus both learned models execute, render actual comparisons and expose airway values. |
| Shell and content | All six routes and every content tab render in EN/ES and light/dark without document overflow or equation errors. All five architecture diagrams fit; mobile native-size mode scrolls inside its container. Keyboard focus remains inside the modal, and Escape restores its opener. |

The tests found and drove correction of five concrete regressions: mobile Load/Save buttons lost their accessible names when text was hidden; a transform-control event ordering error updated only the movement preview; a stale predicted result could be paired with a newly imported topology and crash the workspace; the shared architecture modal allowed Tab to reach background controls; mapped scientific-diagram nodes emitted a missing-key React error. The tests retain those reproductions. An automatic fixture rejects browser `console.error` and uncaught page errors in every workflow.

Shared-shell **0.6.7** carries the focus/native-diagram fix upstream. It passed 36 package tests and eight standalone Chromium combinations (mobile/desktop × EN/ES × light/dark), was promoted through PRs #24 and #25, and was published from main `fed727a07a246311c52eabc0a7b909c88f574b77`. A fresh public npm tarball had SHA-1 `aa227c55f6910a648283c85464ae993ef15365d7`, matching registry metadata. Aerovia installed that version before the subsequent navigation patch. The former Lucide 1.x import fix is in 0.6.6.

The subsequent screenshot review found that the shared header hid companion-route navigation below 760 px. Shared-shell **0.6.8**, now pinned by Aerovia, restores the same links in a compact second row with contained horizontal scrolling and automatic visibility on keyboard focus. Twelve additional standalone browser combinations visit all six routes by mouse and keyboard at 320/390/1440 px in both languages/themes; the header stays below 100 px and the main surface retains over 65% of viewport height. PRs #27/#28 promoted main `750489eeb142d04fa47affd1e8214d09184493ec`; the fresh public tarball SHA-1 is `f753928d8cdaa355d759fdb470a4f7b37b04fe0b`. The app mobile journey now visits every companion route and verifies that returning restores the engineering options.

### Layout rejection and measured correction

The immutable candidate `f67329c995bd444d4af41380cc696cd9ff43e8fb` passed its then-current 26 functional workflows but **failed the release layout gate**. At 1280 × 800 the actual canvas occupied 28.76–34.90% of the viewport; at 1600 × 900 it occupied 36.16–41.99%. At 2560 × 1440 it passed the 50% canvas threshold, but the Spanish learned-model controls still overflowed. Of 24 language/theme/mode views at each size, active-panel fit failed 16, eight and two respectively. Document containment and single-row navigation were already correct. A passing functional test suite did not authorize promotion of that candidate.

The correction removes the permanent lower readout/chart dock and display-control row. One context pane uses explicit named task sections; `ToolPages` keeps inactive sections mounted so inference and interaction state survive page changes. Display controls and numerical/transport analysis each have direct access from the canvas bar. Learned comparison separates Run, Accuracy and Comparison. No active content is clipped to manufacture a fit, and no font reduction is used to meet the gate.

The independent dynamic sweep checks **624 unique task-page/result states** across four sizes, EN/ES and light/dark, including continuous release, enabled scheduled intervention, an actual optimized point, speed sweep, eight ranked interventions and all computed learned-model sections. Every active panel fits its client height, every navigation/tab strip occupies one row, and the document equals the viewport. Measurements of the actual canvas are:

| Viewport | Canvas | Viewport area | Active panel client/content height |
|---|---|---|---|
| 1280 × 800 | 969 × 555 | 52.52% | 597 / 597 px |
| 1600 × 900 | 1289 × 655 | 58.63% | 697 / 697 px |
| 2560 × 1440 | 2231 × 1195 | 72.32% | 1237 / 1237 px |
| 390 × 844 | 364 × 535 | 59.16% | 582 / 582 px |

A further 80-state pass checks selected fan equipment, selected airway geometry, pressure-boundary coordinates, actual 70-second transport playback and full focus. The first mobile focus measurement was 79.9016%, below its strict 80% threshold. Reducing only outer focus padding produced a 377 × 710 canvas, **81.32%**, verified in all four mobile language/theme combinations; the threshold was not relaxed. The final actual focus canvases measure 1267 × 667 at 1280 × 800 (82.53%), 1587 × 767 at 1600 × 900 (84.53%), and 2547 × 1307 at 2560 × 1440 (90.30%), identical across the four language/theme combinations. Escape exits focus and preserves the project. The mobile shared header retains its distinct brand/actions row and one navigation row at 73.61 px.

The paged workflow also exposed a regression where failed transport requests opened Monitor while leaving the repairable input error hidden in Release. Monitor now displays the actual error and an Edit release action; cancellation remains available during a running calculation. The invalid continuous-release timing test retains this reproduction.

Ignored local evidence is under `build/local/browser-review-final/` (rejected candidate), `build/local/reflow-engine/` (624 unique states; 11 duplicate observations from an interrupted development run are excluded), `build/local/reflow-special/`, `build/local/reflow-special-focus-corrected/` and `build/local/reflow-focus-final/`. The committed Playwright tests reproduce containment, panel fit, one-row navigation and actual-canvas area in both languages/themes. Production-head and live-deployment verification remain separate release gates.

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

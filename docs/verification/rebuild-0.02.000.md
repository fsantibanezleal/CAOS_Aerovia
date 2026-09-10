# Rebuild verification: 0.02.000

This rebuild follows the initiating user's rejection of the original custom interface. Its numerical and deployment records are historical evidence, not acceptance of its user experience. Current scope: [ADR-003](../architecture/ADR-003-shared-spatial-workspace.md).

## Numerical and scientific checks

- 312 browser-engine, authoring, table-import, transport, routing, storage and learned-domain unit tests pass locally.
- The CPU Python suite passes 70 checks with three optional GPU skips; the CUDA surrogate suite passes 14 checks. Eight notice-integrity tests prevent the required, pinned vendor attribution block from becoming a general public-source scan exemption.
- Transport/routing has 58 analytical, conservation, reversal, scheduled-change, boundary, path and work-admission checks. Authoring/table input adds 61 dedicated transactional/validation checks.
- Numerical artifact validation checks twelve canonical networks, 3,072 actual CUDA uncertainty draws and 96 independently matched SciPy samples without changing the accepted catalog.
- Learned validation requires all 24 ONNX exports, checkpoints, 144 replay cells and 216 method/case/regime benchmark cells. Actual split/training/inference/calibration/held-out-family evidence is documented in [learned methods](../methods/surrogates.md).
- Actual Chromium WASM parity evaluates two identical held-out inputs for each of 24 exports, plus closure, extrapolation and fan-off controls. The committed receipt is `data/models/browser-evidence.json`; maximum measured flow/pressure export delta is 9.1553e-5 m³/s / 0.00268555 Pa.
- Built-production runtime inspection executes all twelve cases with both models, agrees with recorded output metrics, observes exactly one first-party WASM file, and detects no external runtime request or page error. This is distinct from a development-server fixture test.

## Complete interaction evidence

The rebuilt E2E suites exercise actual design authoring and exported coordinates, not only control visibility. A junction drag must commit its coordinate, persist and undo. Invalid JSON and mapped tables preserve the prior design. Exported transport inputs rerun to identical output frames. Scheduled and continuous sources retain a complete mass ledger. Directed routes, exact-input uncertainty, linked plots, optimization restrictions and model-domain rejection have explicit journeys.

Review corrected a TransformControls event-order defect that previewed a move without committing it, a stale learned-field dimension mismatch after importing another network, unnamed mobile Load/Save controls, and escaping keyboard focus in the shared architecture dialog. These failures remain regression triggers. The shared fix was published upstream. Shell 0.6.8 also restores every companion route on mobile with visible, scrollable navigation; Aerovia consumes that published version.

An analytical fan fixture verifies 10 MWh / 2,000 entered-currency annual cost at 8,000 hours and tariff 0.2; half-speed gives 1.25 MWh / 250, with baseline cost change -1,750. Level isolation is checked through actual scene picking: a hidden airway cannot be selected and becomes selectable again when all levels return, while physical inputs and flow remain unchanged.

## Rendered review and reproduction

The companion-content review exercised 624 route/subtab/diagram captures across EN/ES, both themes and desktop/mobile; no measured viewport overflow, KaTeX parse errors or SVG bounds faults remained. Separate interactive benchmark review executes 48 actual model comparisons, 24 heatmap selections and filtered confusion-count reconciliation. The measured 89.45% undercoverage case remains visible rather than being replaced by nominal 95% coverage.

The preceding workbench inventory contains 96 main views and 24 mobile control views. Review corrected the learned-field readout to show the active prediction, exposed selected-airway uncertainty and fan-power intervals on mobile, preserved the depth-label sign at the viewport edge, and distinguished small-range chart ticks. Two focused browser regressions pass the corrected source and fail the preceding immutable build for the actual prediction/readout mismatch and missing mobile interval. The final release suite contains 34 complete workflows, including eight strict layout/focus checks.

The earlier 1440×900 instrument-area description did not establish the actual canvas-area and control-fit requirements. It is withdrawn as evidence that the layout passed. The companion-content review checks document, equation and diagram behavior; it does not substitute for measuring the workbench canvas and every active control task.

## Rejected layout and current retest

The immutable build from `f67329c995bd444d4af41380cc696cd9ff43e8fb`, reviewed at `http://127.0.0.1:4911`, passed 26 interaction workflows but **failed the ADR-0071 layout gate**. Its receipt is `build/local/browser-review-final/summary.json`. All 24 reviewed states at 1280×800 and all 24 at 1600×900 gave less than half of the viewport to the actual canvas. Control panels also overflowed. Passing document containment and navigation checks did not compensate for those failures.

| Viewport | Actual canvas / viewport | States below 50% | Control-fit failures |
|---|---:|---:|---:|
| 1280×800 | 28.76–34.90% | 24/24 | 16/24 |
| 1600×900 | 36.16–41.99% | 24/24 | 8/24 |
| 2560×1440 | 54.62–59.42% | 0/24 | 2/24 |

The reflow removes the bottom dock and places the active task in one pane with task sections. The normal-layout retest in `build/local/reflow-engine/measurements.json` contains 635 observations, including 11 duplicate observations before a development-server reload. Deduplication by viewport, language, theme and task produces **624 distinct states**, comprising 39 tasks at four viewports in EN/ES and both themes. Those states have no active-panel or document overflow, navigation wrapping, reported browser errors or failed measurements. The cross-platform correction below supplements these original Windows observations; publication identity is established separately by the release manifest and GitHub release receipt.

| Viewport | Distinct reviewed states | Actual canvas / viewport |
|---|---:|---:|
| 1280×800 | 156 | 52.52% |
| 1600×900 | 156 | 58.63% |
| 2560×1440 | 156 | 72.32% |
| 390×844 | 156 | 59.16% |

The expanded layout tests subsequently found mobile focus at 79.9016%, below its 80% requirement. Reduced outer focus spacing corrects the actual canvas to 377x710 pixels, **81.3191%**, in all four mobile language/theme combinations. The selected-fan, pressure-boundary geometry and calculated 70-second transport follow-ups fit; the mobile regression retains its original 80% threshold. Final focus allocations are 82.5282%, 84.5298% and 90.3030% at the three desktop sizes, verified in all language/theme combinations. The final combined **34-workflow suite passes in 3.1 minutes**, including Escape exit and the original numerical/authoring assertions. A clean immutable build, current-head CI and fresh public-domain verification remain separate release gates. The transport timeline continues to use calculated cell fields and the selected airway monitor; this layout revision does not change its numerical model.

Run `scripts/local/06_verify.ps1 -Browser` or `bash scripts/local/06_verify.sh --browser` for the release gate. Local QA artifacts live under ignored `build/` and browser reports; CI retains its actual browser artifacts. Publication identity, successful main workflow and fresh public-domain journeys are separate release gates and are recorded in the release receipt after deployment. A local test result alone does not establish that the new release is serving publicly.

The clean immutable `d3193d03c98389a5363289e70c85d0d4519c05b5` build passed all 34 workflows in 167.850 seconds on Windows Chromium, with no failures, retries, skipped cases or browser errors. Its 119 served files (25,661,499 bytes) passed independent byte-length and SHA-256 verification. The concise local browser receipt has SHA-256 `b7ac52a0d3586909ca4efd535b8ae86501193a6876e81c29c5a1cb5caad05277`. These results did **not** authorize promotion: Linux CI run `34439846295` subsequently failed seven layout checks. That candidate was held and corrected before release.

An isolated Ubuntu 24.04 Chromium image with the CI font fallback reproduced exactly 602 pixels of English Accuracy content in a 597-pixel pane. Spanish content exposed another overflow after the first correction. The final layout pairs the predicted/numerical field actions with concise visible labels and retains all four numerical metrics, accessible action names and inference timing. The execution-versus-physical-balance explanation remains in Run. No font size, numerical control, overflow rule or acceptance threshold was reduced to hide the failure.

The separate focus failure came from measuring the canvas before its asynchronous ResizeObserver finished resizing. The gate now waits for actual canvas dimensions to match its scene container, then applies the unchanged 50%/80% area and complete-control-fit requirements. Every failure message identifies its language, mode and task. The corrected build passes all eight Linux layout cases in **1.4 minutes**, covering the four sizes, both themes, EN/ES and actual model inference. Three focused Windows workflows pass in **39.1 seconds**, including prediction-value/physical-residual coherence and both mobile themes. Current-head CI and fresh public-domain verification remain the publication gates; these local results do not substitute for either.

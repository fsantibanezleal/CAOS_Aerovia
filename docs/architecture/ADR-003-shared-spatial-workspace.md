# ADR-003: direct engineering work in the shared CAOS workspace

Status: implemented, 2026-09-10. Supersedes ADR-001.

## Problem and authority

The initiating user rejected v0.01.000. Its custom composition, two permanent side panels, JSON-dependent topology editing and limited spatial interaction did not meet the requested product. Successful numerical checks and deployment did not establish product acceptance. The user explicitly requested a complete rebuild using the CAOS ADRs and UI/UX templates.

## Decision

Use the actual published `@fasl-work/caos-app-shell`: AppShell, CaseSelector, Tabs/SubTabs, shared language/theme state, Equation, Cite/Refs, and the five-part architecture modal. The six routes are App, Introduction, Methodology, Implementation, Experiments and Benchmark. Product CSS styles the instrument and its controls within the shared layout, without duplicating the header/footer or scientific page primitives.

The App uses one contextual control area divided into explicit task sections and a dominant spatial instrument. The same area contains linked plots and result inspection; a permanent lower dock does not consume the canvas. A named native selector switches sections while retaining their state. Global conditions and selected equipment are separate, as are release settings, scheduled changes, playback and mass balance. Focus fills the viewport and provides an accessible tool toggle and Escape exit. Mobile controls open as an overlay. Visual authoring includes Select, Draw, Connect and Move, constrained elevation/snapping, numeric coordinates and boundaries, splitting, equipment changes, closure, undo/redo, separate CSV node/airway import and project save/load. Intersections become graph connections only through explicit edits.

Dynamics represent numerical state: a conservative finite-volume passive tracer follows signed solved airflow through tunnel cells. Pause, scrub and playback select calculated frames. Sources and scheduled operating changes alter the solution, and every frame retains its mass ledger. Directed routes use nominal airway volume/flow, not human evacuation time. Shared visualization lifecycle stops playback when hidden; a static design does not run decorative animation.

The existing independent reference and CUDA uncertainty pipeline remains. Actual locally trained topology MLP and graph surrogates add a separately labelled screening lane with checkpoints, ONNX exports, calibration/test separation, physical residuals, held-out family diagnostics and explicit domain rejection. A model prediction never establishes exact numerical convergence. Input identity is checked synchronously before any result is drawn on a changed network.

## Hosting and reproducibility

GitHub Pages and the existing custom subdomain remain sufficient. Uploaded designs stay in browser memory/device storage, numerical work runs in workers, and inference loads first-party WASM/ONNX. Heavy training and uncertainty processing run locally. The complete deployment budget is 32 MB, with each file below 25 MB; the expanded scientific release measures about 25.3 MB before final version metadata. The single ONNX WASM runtime is loaded on demand. Checkpoints and training arrays are not site payloads.

## Verification and consequences

Verify full design authoring and round-trip exports, transport analytical solutions and conservation, routed paths, fan operations, learned inference and domain rejection, linked selections, keyboard focus, viewport allocation, and rendered EN/ES light/dark desktop/mobile content. A screenshot or a count of tests alone does not replace executing the operations. Release receipts distinguish local implementation, public deployment and user acceptance.

The pre-release viewport audit rejected a functioning build whose canvas occupied only 28.76-34.90% at 1280x800 and whose long panels hid controls. The corrected layout must measure the actual canvas at 1280x800, 1600x900 and 2560x1440, not count its surrounding instrument container as visualization. Every task section must fit without vertical panel scrolling; focus must exceed 80% canvas allocation.

Shared defects are fixed upstream: shell 0.6.6 repairs current Lucide module loading; 0.6.7 adds architecture focus containment/restoration and full-size mobile diagrams; 0.6.8 exposes every companion route in compact scrollable mobile navigation. Aerovia consumes the published packages rather than copying a patched shell.

Primary design references: [Ventsim drawing manual](https://www.ventsim.com/files/VentsimManual.pdf), [NIST CONTAM theory](https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1887r1.pdf), [Three.js TransformControls](https://threejs.org/docs/pages/TransformControls.html). These motivate independently implemented tools; they do not imply equivalent physical scope or field validation.

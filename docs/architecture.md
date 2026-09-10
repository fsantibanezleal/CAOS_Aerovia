# System architecture

Aerovia uses one editable ventilation graph across spatial authoring, exact numerical tools, passive transport and learned screening. Heavy processing runs locally; verified results and compact model exports are published as static files. The browser has no application backend and does not upload engineering designs to a computation server.

## 1. Engineering object and scope

Junctions define coordinates and optional fixed-pressure boundaries. Airways define connectivity, positive quadratic resistance, area, forward-flow target, role, level and an optional fan curve. Operating options hold common fan speed, global resistance scale and validated airway overrides, including closure.

The open network obeys the signed branch relation and internal conservation:

```text
p_from - p_to + H0 × speed² = (R + k) × Q × |Q|
B_internal × Q = 0
```

Pressure uses Pa; flow uses m³/s; coordinates use metres with Z up; area uses m². Airway resistance and fan coefficient use Pa·s²/m⁶. Geometry supplies represented centerline length for route weights and transport volume, with optional explicit length overrides in the complete transport request. Geometry and area never silently recalibrate resistance.

Validation rejects invalid IDs/endpoints, nonfinite values, unsupported bounds and open components without a pressure boundary. The exact network engines support at most 120 junctions and 240 airways. Browser JSON input is limited to 2,000,000 bytes; offline network input to 5 MiB. Mapped table ingestion has its own documented limits and explicit conversions. See [physical equations](methods/ventilation-model.md), [table import](methods/table-import.md) and [network authoring](methods/network-authoring.md).

## 2. Shared shell and application state

`frontend/src/main.tsx` mounts the published `@fasl-work/caos-app-shell` 0.6.8. It supplies six routes, shared language/theme state, the case selector, source controls and the architecture modal. Companion pages use the actual shell's Equation, Cite/Refs, Callout and SubTabs primitives. Aerovia does not copy its own header, footer or scientific-page layout over that package.

`workbench/Workbench.tsx` composes the dominant scene, one contextual operating area and the coordinated analysis dock. Focus mode hides the contextual area; mobile controls use an overlay. `workbench/useWorkbench.ts` owns active network/options, result association, history, baseline and selection. `ProjectDialog.tsx` handles project and mapped-table input. Result identity is checked against the active physical input before dependent rendering; an old prediction cannot be drawn onto a newly imported graph.

| Browser module                                     | Responsibility                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `scene/MineScene.tsx`, `scene/field.ts`            | Three.js geometry, picking, direct authoring handles, level isolation and numerical field rendering.          |
| `engine/editor.ts`, `engine/tableImport.ts`        | Transactional graph edits and explicit source-table mappings.                                                 |
| `useEngine.ts`, `engine/worker.ts`                 | Steady solve, fan curve, sensitivity and optimization requests.                                               |
| `workbench/useTransport.ts`, `transport.worker.ts` | Cancellable transport work, input identity and calculated-frame playback.                                     |
| `learned/`, `workbench/LearnedComparison.tsx`      | Model identity/domain checks, verified ONNX/WASM inference and current-input comparisons.                     |
| `components/Plot.tsx`, `components/FanPlot.tsx`    | Linked analytical views with shared physical selections.                                                      |
| `storage.ts`, `contracts.ts`                       | Validated portable project inputs, local recovery, baseline and typed quantities.                             |
| `content/`, `pages/`                               | Scientific explanation, twelve case companions, five architecture diagrams and live/artifact benchmark tools. |

The [spatial design record](methods/spatial-workspace.md) documents actual interaction semantics. A visual crossing is not automatically a graph junction. Split creates a real intermediate junction and apportions series resistance; a fan remains assigned to one resulting airway. Move commits actual coordinates, with undo/redo and numeric alternatives. Display width, camera, level separation and visible cut do not alter physical inputs.

The shared visualization lifecycle stops playback when hidden. A static design does not run decorative motion. WebGL graphics are separate from local Python CUDA processing. If WebGL cannot initialize, the tables and analytical tools retain the validated project and numerical operations.

## 3. Exact live numerical lane

The steady worker dispatches typed requests with increasing IDs. Replies resolve or reject matching requests; worker failures reject pending work, and unmounting terminates the worker. Application identity guards prevent stale responses from replacing newer inputs.

The TypeScript engine solves nodal pressure using damped Newton continuation and grounded linear systems, then checks the original signed quadratic equations. Accepted outputs require maximum internal volume-flow imbalance ≤ 10⁻⁶ m³/s, branch pressure residual ≤ 10⁻⁵ Pa, fixed boundaries and supported fan delivery. An approximate model's successful execution does not reuse this convergence flag as an availability flag.

Fan analysis includes 21 actual speed-sweep solutions, one-at-a-time +5% resistance perturbations, and feasible common-speed bisection within [0,1.5]. The optimizer requires equal prescribed boundary pressures. A method restriction or failed solve is distinct from bounded infeasibility demonstrated by a converged maximum-speed solution. These tools do not optimize independent fan speeds or excavation topology. The equivalent system curve has separate single-active-fan and pressure-boundary restrictions. Read [engine details](engine/README.md).

## 4. Passive transport and directed routes

`engine/transport.ts` uses fixed-volume airway cells, signed-flow upwinding, junction mixing and two-stage strong-stability-preserving Runge-Kutta integration. Cell mass is in mg, concentration in mg/m³, and advective mass flux is |Q|C. Every frame reports injected, stored, escaped and removed mass plus a balance error. External pressure boundaries are clean reservoirs.

The default discretization is 6 cells per airway and 121 output frames. Admission limits include 16 cells, 301 frames, 32 releases, 24 operating changes, 86,400 seconds, 200,000 integration steps and 40 million cell steps. The CFL/loss bound is 0.45; a smaller requested time step supports refinement. The integrator aligns with releases and operating events and does not silently coarsen a rejected workload.

Scheduled fan speeds and closures re-solve quasi-steady airflow while retaining tracer mass. Changing storage volume during a schedule is unsupported. The transport worker is cancellable and cannot publish a result for a replaced input. Playback selects computed frames, and a selected airway links concentration history, time selection and the tunnel field. Export includes the initial network/options, exact request and every frame. `scripts/transport.mts` exposes the same numerical implementation as a local CLI.

`engine/routing.ts` orients eligible airways by actual signed flow and minimizes the sum of represented volume divided by flow magnitude. Strongly connected components expose recirculation; zero-flow and unreachable paths remain explicit. This is nominal airflow transit, not earliest tracer arrival or human evacuation. Transport does not resolve heat, fire chemistry, toxicology or three-dimensional turbulence. See [transport](methods/transport.md), [routing](methods/routing.md) and the [operating/local reproduction guide](guides/05_spatial-and-transport.md).

## 5. Independent offline numerical processing

`scripts/pipeline.py` orchestrates deterministic case creation, checksum-pinned HTTPS acquisition, validation, reference solves, CPU/CUDA uncertainty and verified publication.

| Module in `data-pipeline/aerovia_pipeline/` | Responsibility                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `cases.py`                                  | Twelve original engineering scenarios with provenance and licensing.                                                |
| `model.py`                                  | Input validation and independent mixed flow-pressure SciPy trust-region least squares with an analytical Jacobian.  |
| `ensemble.py`                               | Identical seeded lognormal draws, NumPy/PyTorch CUDA batches, physical checks and independent same-draw references. |
| `io.py`, `cli.py`                           | Acquisition, input identities, CSV/JSON, manifests and transactional output promotion.                              |

Uncertainty batches use float64 and up to 256 realizations per nonlinear batch. CPU and CUDA consume the same NumPy-generated resistance draws. Publication retains failure accounting and requires complete accepted evidence. Eight saved draws per canonical case receive independent SciPy checks. This uncertainty stage is numerical ensemble processing; learned training is a separate lane.

CPU Python 3.13 uses `.venv/`; the verified CUDA/training Python 3.12 uses `.venv-gpu/`. Normal outputs are ignored local work. Candidate outputs are verified before promotion, with failed work preserving accepted results. See [processing](guides/02_processing.md), [CUDA operations](guides/03_gpu.md) and [uncertainty assumptions](methods/uncertainty.md).

## 6. Trained response models and browser inference

`scripts/surrogates.py` and the PowerShell/Bash training wrappers expose ingestion, preprocessing, dataset generation, features, training, inference, evaluation, diagnostics, export and validation. The corresponding `surrogate_*.py` modules separate these responsibilities. Training stores selected weights, histories, partitions and resumable optimizer/scheduler/random state; deployment never trains.

The topology-specific MLP uses two hidden layers of width 128. The shared graph model uses width 32 and four message-passing steps. Both predict a correction around disclosed nominal calibration, expose raw flow, project internal conservation and reconstruct pressure by least squares. Physical pressure residuals remain visible. Exact common-speed scaling is encoded for the supported zero-boundary setting rather than claimed as learned low-speed generalization.

The executed source contains 33,792 numerical states, including 3,072 held-out tests with independent SciPy labels. Twenty-four ONNX exports represent two methods across twelve calibrated networks; the graph weights are shared across those fixed-graph exports. `science.json` contains 144 learned replay predictions and 216 test method/case/regime cells including the classical reference. Calibration, synthetic input degradation and a separately trained room-and-pillar family holdout remain distinct experiments.

`learned/index.ts` verifies registered model paths, byte counts and SHA-256 before creating an ONNX Runtime Web session. Inference uses a single first-party WASM runtime and one CPU thread. Source-machine paths are removed from public graphs. Known topology/ordering, fan/boundary assumptions, supported resistance ratios and speed define the live domain. Closure, an unknown or changed physical topology, or extrapolation produces an explicit domain rejection while the exact solver remains available.

A current numerical reference must satisfy the same inputs before comparison. The browser measures inference separately from initial loading and recomputes physical scalars; it does not hide a nonlinear corrective solve inside the model. Actual Chromium parity covers 48 predictions across all 24 exports, plus negative controls. Read [training and measured evidence](methods/surrogates.md) and the [model contract](data-contract/learned-models.md).

## 7. Projects, evidence and identity

`storage.ts` persists `aerovia.project/v1` locally. Portable projects store network/options and optional baseline inputs. Imported result arrays do not become authoritative baseline answers: restoration validates and recomputes them. Rejected JSON or table input preserves the active design. File export is the durable transfer mechanism; no application server stores visitor data.

| Object                    | Versioned scientific content                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Network / project         | Graph, provenance, engineering parameters and recoverable input state.                                          |
| Catalog / result          | Embedded inputs, signed arrays, exact numerical status, metrics and execution identity.                         |
| Ensemble / references     | Distribution, seed, quantiles, target fractions, accepted/failed counts and matched-draw checks.                |
| Science                   | Method/case/regime results, held-out matrices, calibration, degradation, family transfer and training evidence. |
| Model registry / manifest | Topology/calibration identity, supported domain, checkpoint/export hashes and byte counts.                      |
| Browser evidence          | Actual exported inference parity and negative-control outcomes.                                                 |

Verification combines input identity, schema, bytes, dimensions, recomputed physical equations, derived metrics, quantile ordering and complete expected coverage. A hash establishes file identity; physical checks establish the recorded equation behavior. Neither establishes mine-site calibration.

The browser's canonical uncertainty is shown only while physical input/options match its recorded case. Edited designs need a new local bake. The Benchmark error map reads recorded test cells directly, exposes raw and projected errors, and filters detailed rows and confusion counts together. Actual calibration undercoverage and unsupported domains are retained. Public evidence downloads permit independent inspection.

## 8. Static publication and operation

`frontend/prepare-data.mjs` validates numerical and learned evidence, copies site payloads and creates release identity from `VERSION`, Git HEAD, checkout cleanliness and catalog SHA-256. Scientific checkpoints and training arrays remain repository/offline artifacts, not web payloads. Vite bundles the shared shell and instrument while loading model and WASM files on demand.

`frontend/generate-manifest.mjs` records exact bytes and SHA-256 for runtime files. `verify-deployment.mjs` fetches the real HTTPS surface, requires an explicit expected commit, rejects dirty release identity and foreign-origin redirects, and enforces a 32 MB total budget with 25 MB maximum per file. One WASM binary avoids duplicate runtime payloads. The manifest-generation step also emits physical `index.html` entry files for every companion route, so GitHub Pages deep links and browser refresh reach the SPA without an application server. Shared-shell 0.6.8 keeps all six routes reachable on mobile; 0.6.7 supplied architecture focus containment/restoration and full-size diagrams.

`.github/workflows/pages.yml` validates public source/history, canonical artifacts, unit tests, types, build and actual Chromium journeys. Publication serves a validated main revision through GitHub Pages. No scientific bake or training occurs during deployment. A scheduled monitor repeats live integrity and interaction checks.

The custom subdomain is `aerovia.fasl-work.com`, with its CNAME in `frontend/public/CNAME`. Static hosting is sufficient because engineering computation remains client-local and heavy preparation is explicit offline work. A future shared workspace or remote processing service would change the data boundary and requires a new decision. See [deployment](guides/04_deployment.md).

## 9. Verification and decisions

The [rebuild verification record](verification/rebuild-0.02.000.md) reports 312 frontend unit tests, numerical and trained-model validation, real authoring/transport/browser journeys and bilingual themed responsive review. The [companion review guide](rebuild-content/README.md) reproduces scientific-page, SVG and live-benchmark checks. Local implementation, passing tests, public deployment and user acceptance are separate evidence states.

[ADR-001](architecture/ADR-001-original-workbench.md) is superseded. [ADR-002](architecture/ADR-002-numerical-and-hosting-scope.md) defines numerical and hosting scope; [ADR-003](architecture/ADR-003-shared-spatial-workspace.md) records the actual shared-shell rebuild and direct engineering workflow. Extend an operation through validated input, numerical implementation, independent evidence, useful controls, documentation and reproducible artifacts together.

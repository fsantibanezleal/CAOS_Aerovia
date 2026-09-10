# System architecture

Aerovia has two independent numerical implementations and three execution boundaries: the live browser
workbench, local offline processing, and publication/replay of verified artifacts. It has no application
backend. A visitor can change a network interactively while retaining an independent, reproducible
source of reference and uncertainty results.

![Aerovia execution and data boundaries](assets/architecture.svg)

## 1. The engineering object

The central object is a directed ventilation graph. Coordinates support spatial inspection; boundary
nodes prescribe pressure. Airways carry connectivity, positive quadratic resistance, area, a forward
target and optional fan parameters. A separate options object holds common fan speed, global resistance
scale and validated edge overrides, including closures.

An open branch and its internal junctions obey

\[
p_u-p_v+H_0s^2=(R+k)Q|Q|,\qquad B_{\mathrm{internal}}Q=0.
\]

The [physical model](methods/ventilation-model.md) defines signs, SI units and acceptance criteria.
Validation rejects invalid topology, nonfinite values, unsupported bounds and closures that isolate an
internal node from every pressure boundary. Both implementations cap networks at 120 nodes/240 edges.
The browser accepts one network or project up to 2,000,000 bytes; the offline CLI accepts files up to
5 MiB and arrays of at most 100 cases. Coordinates and area do not silently create a calibrated resistance
model.

## 2. Live browser lane

`frontend/src/App.tsx` coordinates network, operating options, result/input association, baseline, edit
history, selection and import/export effects. Typed `components/AnalysisView.tsx` and `NetworkView.tsx`
present that controller state through explicit data/callback props; solver logic stays in the engine.
`components/Numeric.tsx` commits valid numeric drafts on blur/Enter, and `presentation.ts` centralizes
number formatting. React updates controls, inspector, scene and analysis from the same current state.
A rejected import preserves current work, and a failed calculation cannot become a successful result.

The header information control opens `components/Architecture.tsx`, a bilingual architecture dialog.
Its explanations expose browser, local-compute, publication and contract boundaries from inside the app.

`useEngine.ts` creates a module Web Worker and assigns increasing request IDs. `engine/worker.ts`
dispatches `solve`, `curve`, `sensitivity` and `optimize`. Responses resolve or reject the matching
request. Worker failures reject pending requests; unmounting terminates the worker. Application revision
checks keep an older calculation from replacing newer inputs, and result interpretation is gated while
calculation is pending or failed.

The TypeScript engine uses damped nodal-pressure Newton iteration, continuation and grounded linear
systems. It checks the final exact signed quadratic branch equations and flow balance. Acceptance
requires mass residual ≤ 10⁻⁶ m³/s, pressure residual ≤ 10⁻⁵ Pa and supported fan operation. The
[engine documentation](engine/README.md) explains scaling, iteration limits and diagnostics.

`scene/NetworkScene.tsx` uses Three.js and OrbitControls. Geometry, picking, directional particles and
color encodings consume the same graph/result as the inspector and charts. Level separation and the
presentation envelope are visual aids, not physics inputs. GPU graphics rendering is distinct from
Python CUDA processing. Without WebGL, the network table and numerical tools remain available.

`Plot.tsx`, `FanPlot.tsx` and `Intervals.tsx` display deterministic and uncertainty results. Analysis is
bounded and explicit: 21 actual speed-sweep solutions; one-at-a-time +5% resistance perturbations; and
minimum common fan speed within [0,1.5]. Optimization requires equal prescribed boundary pressures.
A method restriction or failed numerical solve is distinct from a converged maximum-speed result that
cannot meet the targets; only the latter supports bounded infeasibility. The equivalent system curve
requires one active fan, equal boundary pressures and supported positive flow. Closed fans, stopped or
zero-flow states, multiple active fans and unequal boundary pressures receive their own explanations.
These guards avoid presenting a plot as a broader fan/topology optimization method.

## 3. Local projects and imported inputs

`storage.ts` owns `aerovia.project/v1` and device-local persistence. A portable project stores network,
options and optional baseline **inputs**. Imported baseline result arrays are never trusted: restoration
revalidates the inputs and recomputes the result. Export projects for portable backups; browser storage
can be cleared. See the [project contract](engine/project-contract.md).

The public library contains authored cases with provenance and license. Practitioners can import another
valid network, edit its structure as JSON, solve interventions and export results locally. Meaningful
resistances, boundaries and target assumptions must come from the engineering problem. Imported content
is never sent to a processing server. GitHub Pages serves static application files under its own hosting
policies; that is separate from application-local data processing.

## 4. Independent offline lane

`scripts/pipeline.py` exposes the portable CLI. Product-specific modules separate these responsibilities:

| Module in `data-pipeline/aerovia_pipeline/` | Responsibility |
|---|---|
| `cases.py` | Deterministic creation of twelve authored scenarios |
| `model.py` | Input validation, equation assembly and independent SciPy reference |
| `ensemble.py` | Shared seeded draws, CPU/CUDA solves, chunking, residual/fan checks and reference comparisons |
| `io.py` | Validated acquisition, identities, CSV/JSON, manifests and transactional promotion |
| `cli.py` | `create`, `fetch`, `validate`, `solve`, `bake`, `verify` orchestration |

The reference uses SciPy trust-region least-squares on simultaneous edge-flow/internal-pressure
unknowns, with an analytical Jacobian. This differs from the browser's nodal method. The GPU lane uses
PyTorch float64 batched Newton systems on actual CUDA hardware; the CPU batch alternative uses NumPy.
There is no learned surrogate, training stage or checkpoint.

Both devices consume identical NumPy-generated lognormal resistance draws. Processing uses at most
256 realizations per batch and supports 8–8192 draws per run. Every draw must pass physical and fan
checks; failures remain explicit. Eight saved draws per case receive independent SciPy solutions.
Agreement verifies an implementation under the assumed distribution, not survey-calibrated uncertainty.
See [uncertainty](methods/uncertainty.md) and [executed evidence](methods/execution-evidence.md).

CPU Python 3.13 uses `.venv/`; the tested CUDA Python 3.12 uses `.venv-gpu/`. Normal runs write to
`build/local/`. Solve/bake stage into a sibling directory, verify the complete result, then promote
accepted output. Failure preserves existing accepted artifacts; unowned nonempty directories, extra
unowned files and symlinks are refused.

## 5. Contracts and artifact identity

The [data contract](data-contract/data-contract.md) governs the processing boundaries:

| Object | Versioned content |
|---|---|
| Network / project | `aerovia.network/v1`, `aerovia.project/v1`; graph, provenance and validated inputs |
| Catalog / result | `aerovia.catalog/v1`, `aerovia.result/v1`; embedded inputs, signed arrays, diagnostics and measured benchmark |
| Ensemble / references | `aerovia.ensemble/v1`, `aerovia.reference-checks/v1`; settings, summaries, failure records and matched reference fixtures |
| Manifest | `aerovia.manifest/v1`; bytes/SHA-256, source identity, actual device and engine version |

Verification checks embedded/aggregate source and option identity, exact bytes, dimensions, conservation
recomputed from output arrays, derived metrics, quantile ordering and acceptance bounds. Adding
`--input data/cases.json` also matches the separate canonical input file against the catalog. Hashes
establish identity and accompany physical checks.

The browser fetches the deployed catalog and validates networks. Canonical uncertainty appears only
while the original network/default options match. Edits invalidate the baked match while keeping live
deterministic tools available. A matching new ensemble is an explicit offline operation on exported
inputs, not a silent interpolation of old uncertainty bands.

## 6. Publication and operation

`frontend/prepare-data.mjs` checks catalog bytes/SHA-256 against the artifact manifest and stages the
catalog for Vite. It also writes `release.json` with `version` from `VERSION`, `commit` from the current
Git HEAD, `workingTreeDirty` from Git status and `catalogSha256` from the verified catalog entry.
The build's `postbuild` step runs `frontend/generate-manifest.mjs` to write `asset-manifest.json` with
that identity and exact bytes/SHA-256 for every runtime file except `CNAME` and the manifest itself.
`frontend/verify-deployment.mjs` fetches the deployed manifest and all listed files, enforces an
explicitly supplied expected commit and rejects dirty builds, foreign-origin redirects and payloads
over 25 MB. Build releases from a clean checkout and retain the matching successful workflow run,
deployed-file verification and browser interaction evidence together.

React, Three.js and runtime assets become a static bundle. `.github/workflows/pages.yml` checks public source/history, reference tests,
canonical input/artifact identity, frontend types/tests/build and Chromium journeys. Only a successful
main revision publishes through GitHub Pages. Deployment never performs a scientific bake.

The custom domain `aerovia.fasl-work.com` is bound in Pages settings and recorded in
`frontend/public/CNAME`. No VPS, database, private service token or resident GPU is required. The
[deployment guide](guides/04_deployment.md) covers configuration, HTTPS, exact revision checks and live
interaction verification. A future shared workspace or online processing service would change the
data boundary and require a new architecture decision.

## 7. Decisions and extension points

[ADR-001](architecture/ADR-001-original-workbench.md) records original task-led composition and retained
quality requirements. [ADR-002](architecture/ADR-002-numerical-and-hosting-scope.md) records the supported
model and static hosting decision. Extend an operation vertically: validated inputs, numerical
implementation, independent evidence, UI meaning, documentation and reproducible artifacts together.
A new physical process requires its own complete implementation, not a relabelled visualization.

Primary framework references: [React](https://react.dev/learn), [Three.js](https://threejs.org/docs/),
[Vite](https://vite.dev/guide/),
[Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers),
[SciPy least-squares](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html),
[PyTorch linear algebra](https://docs.pytorch.org/docs/stable/generated/torch.linalg.solve.html).

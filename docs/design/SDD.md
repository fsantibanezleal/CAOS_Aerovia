# Software design document: Aerovia

This is the SDD of Aerovia, the browser workbench for underground ventilation networks (ADR-0075). It was written for release 0.04.000, which takes the product to the current base (shell, product template 0.08.002 guards, contract catalog, executive view, documentation areas) after the product itself was built and released as 0.02.000 and 0.03.000. The design area follows the template's form, and the guard `scripts/check_sdd.py` holds every requirement to a gate that exists. The product's earlier documentation (`docs/architecture.md`, `docs/engine/`, `docs/methods/`, `docs/data-contract/`, `docs/cases/`, `docs/guides/`) stays as it is; this document cites it and does not replace it. The features are listed in [`README.md`](README.md).

## Problem and non-goals

Problem: an engineer who plans or reviews the ventilation of an underground mine needs to draw or load an airway network, change a fan, a regulator or a closure, and see the consequence at once in flow, pressure, fan duty, energy, airflow paths, tracer history and the spread of an uncertain resistance, without installing a package, sending the design to a server or trusting a number that has no evidence behind it. Aerovia does this on twelve authored networks or on the reader's own design, in the browser, with the heavy numerical work (SciPy reference solves, CUDA ensembles, model training) done offline and committed as checksummed artifacts that the site only reads.

Non-goals, each something a reader could reasonably assume (`README.md`, `docs/architecture.md`, `docs/cases/README.md`):

- Field validity. The twelve networks are authored engineering scenarios under Apache-2.0, not surveyed or calibrated operating mines; resistance, fan curves and targets are supplied design assumptions, and no legal airflow target is implied. A converged solve means the entered model closes its equations, nothing more.
- Physics beyond the steady isothermal model. The model is constant density and isothermal with signed quadratic resistance and a monotone fan curve; heat, fire and combustion chemistry, toxicology and three-dimensional turbulent eddies are not calculated, and the passive tracer is a quasi-steady mixed-cell model, not an emergency-response or evacuation tool.
- Equipment control. The workbench informs a design decision; it does not drive a fan.
- Large networks. The exact engines accept at most 120 junctions and 240 airways (`frontend/src/engine/validation.ts`, `LIMITS`).
- A backend. The deployment is a static GitHub Pages site with no resident process, database or server-side project storage; a visitor's design stays in the browser.
- Learned models as a source of truth. The two learned methods are approximations trained on simulator labels for the twelve fixed topologies; they make no claim of generalisation to another mine, and a state outside their trained domain is refused, not clipped.

## Executive brief

The first view of the Introduction frames the industry problem behind the workbench for a decision maker. It is one bilingual data file with its linked sources and three illustrations, written from the persisted problem-context research before the base was adopted, validated against the shell's executive schema, and rendered by the shell as the landing. This section names the file and restates nothing; the standard is the executive-brief guide of the product template.

Data file: content/executive.json

## Research basis

Done before the plan and kept here so a reader can re-check it (ADR-0075). The method rows come from the product's research dossiers of 2026-09-09 and 2026-09-10 (the physical model, the transport model, the learned methods and the documentation contract) and from the sources the product cites in `frontend/src/content/citations.ts`; the problem rows come from the problem-context dossier of 2026-10-19, whose figures are the ones `content/executive.json` states with their own linked sources. The table lists what was decided and from what.

| decision | what the research found | source |
|---|---|---|
| The network equations are the signed quadratic branch law with junction conservation and fixed boundary pressures | The Atkinson square law and the signed Q times absolute Q loss, and the separation of compressible and incompressible forms, are developed in the ventilation textbook | McPherson, Subsurface Ventilation Engineering, https://www.srk.com/en/products/ventilation-textbook |
| The offline reference is a SciPy trust-region reflective least-squares solve with an analytical Jacobian | The documented method, its callable Jacobian and its stopping criteria; the tolerances come from Aerovia's own source, not SciPy defaults | https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html |
| CUDA ensembles solve batched float64 linear systems and are checked against the reference | Batched linear algebra for the Newton steps | https://docs.pytorch.org/docs/stable/generated/torch.linalg.solve.html |
| Resistance draws are independent lognormal with arithmetic mean one, sigma from the coefficient of variation | The logarithmic location and scale are not the arithmetic mean and deviation, so sigma and the log-mean are derived | https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.lognormal.html |
| Tracer transport separates pressure-driven airflow from contaminant evolution and uses incoming and outgoing mass flux with sources and sinks | The quasi-steady airflow formulation is the conceptual reference; Aerovia implements a narrower independent model and claims no equivalence | NIST CONTAM theory, https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1887r1.pdf |
| Transport is a conservative upwind finite-volume scheme along the signed solved flow | The scalar advection conservation law relates control-volume mass to inlet and outlet flux, with the upstream concentration carrying the flux | https://www.clawpack.org/riemann_book/html/Advection.html |
| Tracer release and downstream observation have real underground applications, but the model is not validated by them | A mining tracer study discusses experiment design, sampling and network characterisation; it establishes relevance, not validation | Jong, Luxbacher, McNair and Xu 2016, https://stacks.cdc.gov/view/cdc/207736 |
| Airway routes are weighted directed shortest paths with nominal volume over flow as the weight | Dijkstra applies to non-negative weights; the weight is a nominal residence-time proxy, not earliest arrival or human access | https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html |
| Direct manipulation in the editor follows what a network tool offers: draw, move, copy, snap, explicit junctions | The vendor manual documents interactive airway drawing and explicit handling of intersections; a crossing is not a junction until the user splits | Ventsim manual, https://www.ventsim.com/files/VentsimManual.pdf |
| The learned lane is a topology MLP and a shared message-passing graph network, as approximations of the exact solver | Message passing on attributed graphs is an established family; mining-specific performance needs Aerovia's own evaluation | Gilmer et al. 2017, https://proceedings.mlr.press/v70/gilmer17a.html |
| A mine-ventilation MLP from monitored airflow exists, and its metrics are not reusable here | The original study infers global airflow parameters from sensor data and a simulation-derived set; Aerovia has no mine observations | Zhang et al. 2025, doi 10.13272/j.issn.1671-251x.2024090057 |
| Physics-informed graph networks for hydraulics show weak small-flow behaviour and transfer limits | Evaluated on unseen parameter scenarios for water systems; pumps, valves and topology transfer are stated limitations | Ashraf et al. 2024, https://arxiv.org/html/2403.18570v1 |
| Learned preprocessing and metrics are held to leakage-safe splits and declared denominators | Train-only preprocessing and metric definitions | https://scikit-learn.org/stable/common_pitfalls.html |
| The model export uses the dynamo exporter and the browser runs ONNX Runtime Web on WebAssembly | WebAssembly is broadly supported, WebGPU narrower; an export alone is not browser parity | https://docs.pytorch.org/docs/main/onnx_export.html and https://onnxruntime.ai/docs/get-started/with-javascript/web.html |
| Heavy work runs in workers and the static host bounds the payload | Worker and main-thread message boundaries; Pages limits | https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers and https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits |
| The reason to act: the European diesel exhaust limit for underground mining applies from 2026-02-21 | The directive's replaced annex gives 0.05 mg per cubic metre as elemental carbon and the 2026 start for underground mining | Directive (EU) 2019/130, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L0130 |
| Underground ventilation is a large energy use, and strategy changes can save energy | The review of ventilation control strategies and the Canadian laboratory statement on the ventilation share of underground energy | Bajic et al. 2026, doi 10.5937/podrad2648133B; Hardcastle et al. 2007, https://www.osti.gov/etdeweb/biblio/21001277 |
| Network models need calibration to stay useful | A calibration method for ventilation networks from sparse measurements, because resistance is hard to acquire | Wu et al. 2026, doi 10.3390/pr14040715 |
| Requirements are written in EARS form, each with its gate | The five EARS patterns used in the requirements files | Mavin et al. 2009, https://doi.org/10.1109/RE.2009.9 |

Choices with no source because the product's own measurement decides them: the transport defaults (6 cells per airway, 121 frames), the ensemble size (256 draws per case at a coefficient of variation of 0.15) and the common-speed bound of 1.5 times the nominal speed, all read from the code and the committed artifacts (`frontend/src/engine/transport.ts`, `frontend/src/engine/validation.ts`, `data/artifacts/catalog.json`).

UNVERIFIED: what each work says beyond what the dossiers record. The dossiers record the page or PDF each source was read from on 2026-09-09, 2026-09-10 and 2026-10-19; this document did not re-open the pages, so the "what the research found" cells restate the dossiers, and the DOI of Zhang et al. and the DOI of Bajic et al. and of Wu et al. are written as the dossiers print them, without a new Crossref lookup. The problem rows are a short selection; the full set of figures, with their year, scope and caveat, is `content/executive.json`.

## Sizing and contracts

The design rests on the two artifacts of contract-first parallel delivery (ADR-0080): the sizing, kept with the coordination records outside the product (for this release: the components, the modules with their owner units, 19 boundaries, the technology versions read on primary sources on 2026-10-19, the machine limits and the parallel units with disjoint write scopes), and the contract catalog, kept here, [`docs/contracts/catalog.md`](../contracts/catalog.md). Every committed document or boundary of the product is a catalog row with one schema file under `docs/contracts/schemas/`, an example, a producer test, a consumer test, its missing-data behavior, a provider and a swap test. Two of the sizing's boundaries are not rows: the executive view (the shell's contract, `frontend/src/content/executive.test.ts`) and the live parity of the browser solver (a test, `frontend/src/engine.test.ts`).

The 17 rows of the catalog, all at version 1.0.0 with an `initial` History row (`docs/contracts/catalog.md`):

| contract | what it governs | owner (producer) |
|---|---|---|
| network | the twelve authored networks, `data/cases.json` | `data-pipeline/aerovia_pipeline/cli.py` |
| catalog | solver results and the resistance ensemble per network | `data-pipeline/aerovia_pipeline/cli.py` |
| reference-checks | matched resistance realisations with independent answers | `data-pipeline/aerovia_pipeline/cli.py` |
| science | methods, regimes, predictions, benchmark, training and validation evidence | `data-pipeline/aerovia_pipeline/surrogate_export.py` |
| branch-table | the 15-column branch table per case, a published download | `data-pipeline/aerovia_pipeline/io.py` |
| artifact-manifest | digest and size of every published artifact | `data-pipeline/aerovia_pipeline/io.py` |
| browser-evidence | every exported model run in a real browser | `frontend/scripts/verify-learned-browser.mjs` |
| model-manifest | digest and size of every model file | `data-pipeline/aerovia_pipeline/surrogate_export.py` |
| model-registry | one entry per method and network, with checkpoint, ONNX file, signature and training receipt | `data-pipeline/aerovia_pipeline/surrogate_export.py` |
| onnx-parity | float32 inputs and outputs of each exported model | `data-pipeline/aerovia_pipeline/surrogate_export.py` |
| model-io | the input and output tensors of an ONNX file, held to its registry entry (a model slot) | `data-pipeline/aerovia_pipeline/surrogate_export.py` |
| checkpoint | the dictionary `torch.save` writes for a trained model, read without torch (a model slot) | `data-pipeline/aerovia_pipeline/surrogate_train.py` |
| engine-worker | the solver worker request and response by kind | `frontend/src/engine/worker.ts` |
| transport | the transport worker messages, result and replay download | `frontend/src/engine/transport.ts` |
| project | the project file the App exports and imports, 2 MiB limit | `frontend/src/storage.ts` |
| release-identity | version, commit, tree state and digests written at build | `frontend/scripts/prepare-data.mjs` |
| readiness | what is real in a build, row by row, in one of six declared states | `data-pipeline/aerovia_pipeline/readiness.py` |

Missing-data states, one vocabulary for every row (the catalog's rules, applied in order, first match wins; `data-pipeline/aerovia_pipeline/readiness.py` computes them and `data/readiness.json` records them):

| state | when | what the site shows | what the guards do |
|---|---|---|---|
| `available` | the row's documents are all present and current | the result | pass |
| `partial` | a network the catalog lists is absent from `data/cases.json`, or a model file the manifest lists is absent | the result for what exists; each absent network or model says not available yet | pass, naming the absent items |
| `stale` | the recorded engine version differs from the pipeline version | the result and a note with the version that baked it | pass, naming both versions |
| `provider` | the row's catalog status is `active` (a provider serves it) | the result and a note naming the provider kind | pass while the product is being built, never at a release |
| `training` | a model slot answered while training (not used by the static document) | the result and a note naming the model | pass |
| `missing` | the document is absent, or the row is exchanged at run time | an explicit not available yet with the reason, never an empty chart | pass for the run-time rows; a missing committed document stops the build |

On the committed tree the readiness document says `available` for 12 of its 16 rows and `missing` for the four run-time rows (engine-worker, transport, project, release-identity), by design (`data/readiness.json`, `tests/contracts/test_readiness.py::test_the_real_tree_is_available_and_the_runtime_rows_are_missing`). The two model rows are model slots: their baseline provider is the exact SciPy-based solver (`data-pipeline/aerovia_pipeline/model.py`), which answers when no learned model does. The catalog also governs which model files may be tracked: `scripts/check_base_integrity.py` admits a `.onnx` or `.pt` file only when a row declares it, at most 5 MiB each and 50 MiB together (38 files, 5.72 MiB at the catalog's last count).

## Technology and versions

Every pinned dependency of `requirements.txt`, `requirements-gpu.txt` and `requirements-surrogates.txt` (which include one another) and `frontend/package.json`, with the version actually pinned or locked; `scripts/check_tech_matrix.py` fails when a pin and this table disagree. Python pins are exact; the frontend pins are exact in `package.json` and the table holds the version `frontend/package-lock.json` locks. The runtimes are Python 3.13 for CPU work and Python 3.12 for the CUDA and training environment (`README.md`; the receipt of the committed bake records Python 3.12.10), and Node 24 (`frontend/package.json` `engines`). The "alternative considered" column quotes the sizing's technology matrix of 2026-10-19 where it records one (a newer release left unadopted, with its reason); where the sizing records none, the cell says so.

| component | package | version | use | alternative considered |
|---|---|---|---|---|
| engine | numpy | 2.5.3 | seeded resistance draws, the CPU batch solve and every array of the pipeline | 2.5.4, current on 2026-10-19, not adopted: a re-bake on a new numpy is its own release |
| engine | scipy | 1.18.1 | the independent reference: `least_squares`, trust-region reflective, analytical mixed flow and pressure Jacobian (`aerovia_pipeline/model.py`) | none recorded in the sizing; 1.18.1 is current |
| training | torch | 2.13.0+cu126 | CUDA float64 ensemble batches and the training of the learned models (`requirements-gpu.txt`) | 2.14.1, current, not adopted: a new torch would change the committed bake and training receipts |
| export | onnx | 1.22.0 | writing and validating the ONNX graphs | 1.23.2, current, not adopted |
| export | onnxruntime | 1.29.0 | the CPU runtime of the export parity checks; the browser runtime is pinned to the same minor | 1.31.0, current, not adopted |
| export | onnxscript | 0.7.2 | listed in `requirements-surrogates.txt` beside the `dynamo=True` exporter call (`surrogate_export.py` line 30); the repository does not say why it is needed | none recorded in the sizing |
| tests | pytest | 9.1.1 | the pipeline, contract and guard tests and the planted-defect suite (`tests/adversarial`) | 9.1.1, current; the template's pin |
| contracts | jsonschema | 4.26.0 | validates every document against its schema file, at the pipeline writers and in the contract tests | the template's pin; none other considered |
| shell | @fasl-work/caos-app-shell | 0.15.0 | the shared app shell (pinned exactly, ADR-0078); 0.16.0 is adopted at the release | a hand-rolled shell, forbidden by ADR-0078 |
| web | react | 19.3.0 | the UI; a peer dependency of the shell | 19.3.1, current, not adopted |
| web | react-dom | 19.3.0 | the UI renderer; a peer dependency of the shell | 19.3.1, current, not adopted |
| web | react-router | 8.3.1 | the routes (`frontend/src/routes.ts`); a peer dependency of the shell | none recorded in the sizing |
| web | zustand | 5.0.15 | a peer dependency of the shell (no import in `frontend/src`) | none recorded in the sizing |
| web | katex | 0.16.47 | typeset equations through the shell; a peer dependency of the shell | 0.19.0, current, not adopted |
| web | lucide-react | 1.43.0 | icons in the workbench and the scene bar; a peer dependency of the shell | none recorded in the sizing |
| web | three | 0.186.0 | the 3D scene and its picking (`frontend/src/scene/`) | 0.186.1, current |
| web | onnxruntime-web | 1.29.0 | browser inference of the exported models on a single first-party WebAssembly runtime | 1.30.0, current, not adopted; WebGPU rejected as the live baseline because its support is narrower (research dossier) |
| web | papaparse | 5.7.0 | the parser of the mapped node and airway CSV import (`frontend/src/engine/tableImport.ts`) | none recorded in the sizing |
| build | vite | 8.2.2 | bundler and dev server | 8.3.4, current |
| build | @vitejs/plugin-react | 6.1.1 | the React transform for vite | none recorded in the sizing |
| build | typescript | 7.0.2 | type check of the web and the end-to-end specs | none recorded in the sizing; 7.0.2 is current |
| build | tsx | 4.23.13 | runs `scripts/transport.mts`, the command-line transport | none recorded in the sizing |
| build | prettier | 3.9.6 | listed in `devDependencies`; no script or workflow of the repository runs it | none recorded in the sizing |
| build | @types/node | 24.13.4 | types of the build scripts | none recorded in the sizing |
| build | @types/papaparse | 5.5.2 | types of papaparse | none recorded in the sizing |
| build | @types/react | 19.3.0 | types of React | none recorded in the sizing |
| build | @types/react-dom | 19.3.0 | types of React DOM | none recorded in the sizing |
| build | @types/three | 0.185.4 | types of three | none recorded in the sizing |
| tests | vitest | 5.0.0 | the web unit tests | 5.0.5, current |
| gate | @playwright/test | 1.63.0 | the end-to-end journeys and the measured gate's browser, local only | 1.64.1, current, not adopted |

## Resources

What each stage needs on the development workstation (Windows 11 10.0.26300, 2026-10-20, a laptop with the NVIDIA RTX 4070 Laptop GPU of the sizing's preflight; the commands and outputs of every measured row, and the script that polled the memory, are in [`measured-resources.md`](measured-resources.md)). Memory is the largest working set summed over the processes the stage started, polled every 50 ms. The CUDA rows come from the committed receipts of 2026-09-10 (`data/artifacts/catalog.json`, `data/artifacts/science.json`), not from a new run: the base venv has no torch and this release re-trains and re-bakes nothing. No stage needs a network after the install, and the deployed site has no server.

| stage | memory | disk | time | where it runs |
|---|---|---|---|---|
| bake (CPU: `scripts/pipeline.py bake --device cpu --samples 256`, 12 cases, 3072 draws) | 122 MB peak summed (118 MB in the Python process) | 1,646,976 bytes in 15 files (the committed CUDA bake: 1,647,711 bytes) | 389.3 s on 2026-10-20; the committed CUDA bake took 4033.71 ms of pipeline time, of which 1561.81 ms of CUDA batch solves | workstation, never CI, never Pages |
| training (13 trained models: 12 topology MLPs and one shared graph network, from the committed receipt) | not recorded in the receipt; bounded by the card, 7948 MiB free at the sizing's preflight | 1,583,701 bytes of best checkpoints; `data/models` holds 42 tracked files, 6,615,401 bytes | 1268.4 s summed over the 13 models (17.4 s to 1045.4 s each), on 2026-09-10 | the local GPU environment (Python 3.12, CUDA 12.6), never CI |
| tests (pytest, `tests/contracts` and `tests/python`: 199 passed, 4 skipped) | 149 MB peak summed (118 MB in the pytest process) | none kept | 57.6 s | workstation |
| tests (web unit tests, `npm test`: 20 files, 455 tests) | 1743 MB peak summed over 29 processes | none kept | 2.4 s | workstation |
| tests (browser journeys, `npm run test:e2e`: 73 tests) | not measured for this release; the journeys ran in the unit worktrees | none kept | 2.8 min, from the workbench unit's report (73 passed) | workstation, local only |
| install (`npm ci`) | 557 MB peak summed over 10 processes | 354,950 KB in `frontend/node_modules` (`du -sk`) | 59.3 s, with the shared npm cache in the temp root | workstation and the Pages workflow |
| build (`npm run build`: typecheck, data preparation, vite, manifest) | 534 MB peak summed over 17 processes | 25,970,922 bytes in 124 files (the build's static manifest) | 5.3 s | workstation and the Pages workflow |
| deploy payload (GitHub Pages) | none | 25,970,922 bytes uploaded, against a 32 MB total budget and 25 MB per file (`deploy/README.md`) | one Pages workflow run; its duration is not measured in this release | CI after main |

The committed evidence under `data/` is 61 tracked files and 11,586,914 bytes (`git ls-files data`), of which the learned models and their records are the 42 files of `data/models`.

## Lanes

- Offline: `scripts/pipeline.py` creates the twelve cases, solves them with the SciPy reference, runs the seeded resistance ensembles on CPU or CUDA, verifies and promotes the artifacts transactionally; `scripts/surrogates.py` and the training wrappers generate the datasets, train, evaluate, export and validate the learned models. It runs on a workstation, never in CI and never in the browser. The measured bake time and the committed receipt are in the Resources section.
- Replay: the committed artifacts are copied into the site by `frontend/scripts/prepare-data.mjs`, which refuses a catalog, science document or model whose digest or size differs from `data/artifacts/manifest.json`, and `frontend/scripts/generate-manifest.mjs` writes the static manifest and the route entry files. The Benchmark and the Context view read them; a replayed ensemble belongs to its exact recorded inputs, and an edited design invalidates a mismatched interval.
- Live: the steady solver (`frontend/src/engine/solver.ts`, `analysis.ts`) runs in a module worker (`frontend/src/engine/worker.ts`, driven by `frontend/src/useEngine.ts`); the passive-tracer integration runs in a cancellable worker (`frontend/src/workbench/transport.worker.ts`) under admission limits that reject a workload instead of coarsening it (16 cells per airway, 301 frames, 32 releases, 24 scheduled changes, 86,400 s, 200,000 steps, 40 million cell steps, a CFL and loss bound of 0.45, `TRANSPORT_LIMITS` in `frontend/src/engine/transport.ts`); learned inference runs on ONNX Runtime Web, one CPU thread and one first-party WebAssembly runtime (`frontend/src/learned/index.ts`), only when the network is in the trained domain. The basis for putting the solver in the browser is parity with the offline reference, measured in the Method ladder below, not an assumption.
- UNVERIFIED: the per-case solve time of the browser solver. No committed artifact read for this document records it; the Benchmark page measures the live engine in the reader's own browser, and the sizing's machine limits give only the pipeline-side times. A release measurement belongs to the release unit.

## Method ladder

Three rungs, each with one acceptance criterion and its gate (ADR-0069). The numbers are read from the code and from the committed artifacts.

1. The exact solver, in the browser and as the offline SciPy reference. Criterion: an accepted solve has an internal volume-flow imbalance of at most 1e-6 m3/s and a branch pressure residual of at most 1e-5 Pa (`MASS_TOLERANCE`, `PRESSURE_TOLERANCE` in `frontend/src/engine/solver.ts`), and the browser solve reproduces each of the 12 committed reference results to under 2e-6 m3/s in branch flow, 1e-4 Pa in pressure and 1e-5 kW in fan power. Gate: `frontend/src/engine.test.ts` (the reference and the 96 matched resistance draws). Measured on the committed bake: maximum internal mass residual 5.68e-14 m3/s and maximum pressure residual 9.65e-11 Pa over 509 junctions and 656 airways.
2. The CUDA resistance ensemble, the same equations on 256 independent lognormal draws per case (coefficient of variation 0.15, arithmetic mean one) in float64. Criterion: every draw is accepted or recorded as a failure (0 of 3072 failed), and 8 saved draws per case (96 in all) are re-solved with SciPy on the identical vector with a maximum branch-flow difference of 1.18e-11 m3/s. Gate: `tests/python/test_model.py` and `frontend/src/engine.test.ts`.
3. The learned methods, a topology-specific MLP and a shared graph network that predict flow corrections around a disclosed nominal calibration and then project internal conservation. Criterion: the held-out error against the exact solver is reported for every method, case and regime cell (216 of 216 cells present) with failures and out-of-domain refusals shown, never averaged away; the exported ONNX graphs agree with PyTorch within 1e-3 m3/s in flow and 0.05 Pa in pressure, and the real browser run of all 24 exports on 48 held-out predictions differs by at most 9.16e-5 m3/s in flow and 2.69e-3 Pa in pressure. Gates: `tests/python/test_surrogates.py`, `tests/contracts/test_models.py`, `frontend/src/learned/domain.test.ts`.

A fourth rung, a method of the state of the art or a frontier one, is not claimed: Aerovia does not implement a transient airflow solver or a learned model that generalises across topologies, and the topology-family holdout shows the degradation on an excluded family instead of hiding it (`data/artifacts/science.json`, `benchmark.familyHoldout`).

## Cases

Twelve authored networks, 509 junctions and 656 airways in all, each with signed forward targets, in paired interventions that keep every unaffected input identical (`docs/cases/README.md`, `data/cases.json`): three-level production (45 junctions, 57 airways), five-level deep mine (58, 75), room-and-pillar district (27, 42), asymmetric districts (34, 42), open leakage (45, 60), sealed leakage (45, 60), western district regulation (34, 42), development and auxiliary ducts (35, 42), return-shaft maintenance (45, 57), deep district booster (58, 75), independent lower intake (47, 59) and narrow-vein inclined mine (36, 45). Each exists to answer one engineering question, such as how shared shafts redistribute flow, which cross-passages short-circuit a gridded district, or how a series booster changes deep flow and total power. Every case carries six operating regimes with their exact recipes: nominal, turndown (speed 0.65), boost (1.25), working-restriction (working resistance times 3), return-restriction (return resistance times 3) and roughness (all resistance times 1.5) (`data/artifacts/science.json`, `regimes`; recipes from the learned-methods dossier). The reader's own design is a thirteenth case under the category "Your design", built by drawing or by importing a project or mapped CSV tables.

## Oracles

- The closed-form network solutions: series resistance, parallel split and equivalent resistance, common-speed cube laws, and the zero-flow and dead-end cases (`frontend/src/engine.test.ts`, `tests/python/test_model.py`).
- The independent SciPy reference: the same network solved by a different algorithm in a different language, to the tolerances of the Method ladder.
- The matched-draw references: 96 resistance realisations solved on the GPU and again with SciPy (`data/artifacts/reference-checks.json`).
- The one-mixed-volume washout, `M0/V` times `exp(-(Q/V + lambda) t)`, and the Erlang survival expression for equal serial cells, each independent of the integrator, with the exact mass ledger (injected equals stored plus escaped plus removed) (`frontend/src/engine/transport.test.ts`; formulas from the transport dossier).
- Dijkstra fixtures that tell the shortest geometric path from the least nominal advective transit (`frontend/src/engine/routing.test.ts`).
- The ONNX parity fixtures: float32 inputs and outputs of each exported model, replayed in PyTorch, ONNX Runtime CPU and the real browser (`data/models/parity-fixtures.json`, `data/models/browser-evidence.json`).
None of these is a model judging a model, with one disclosed exception: the learned methods are labelled by the exact solver, so their error against it measures approximation, not validity against a mine.

## Deploy driver

GitHub Pages at https://aerovia.fasl-work.com/, a static site with every artifact committed, no secret and no server (`deploy/TARGET` says `pages`, checked by `scripts/check_deploy_place.py`; `deploy/README.md`). The deployment is decided by the workload, not by habit: the numerical work runs offline and the browser loads checksummed summaries and first-party ONNX and WebAssembly assets, so no VPS, resident GPU, database or paid API is needed (ADR-0054 and ADR-0055, unchanged; `docs/architecture/ADR-002-numerical-and-hosting-scope.md`). The measured payload is 124 files and 25,970,922 bytes against the 32 MB budget (Resources). The workflow `.github/workflows/deploy-pages.yml` builds from a verified revision, and `frontend/scripts/verify-deployment.mjs` compares the served bytes and digests with the expected clean revision.

## Risks and kill criteria

- Risk: the browser solver drifts from the offline reference. Kill: `frontend/src/engine.test.ts` fails on the committed reference and on the 96 matched draws.
- Risk: a committed artifact changes under its own contract. Kill: the catalog guards fail (`scripts/check_contracts.py`, `scripts/check_contract_versions.py`, `scripts/check_documents.py`) and the readiness document is stale (`scripts/check_readiness.py`).
- Risk: a learned prediction is shown as a converged physical solution, or an out-of-domain input is answered. Kill: `frontend/src/learned/domain.test.ts` and the browser journey on changed topology fail.
- Risk: a model file or a heavy binary enters the repository without a declared contract. Kill: `scripts/check_base_integrity.py` fails.
- Risk: an edit to the design or the operating point leaves a stale result on screen. Kill: the selection key of the workbench stops moving with the operating controls (`frontend/src/workbench/groups.test.ts`) and the measured gate (G9) fails.
- Risk: the site looks right and is not (a blank scene, a dead control, a route that does not load directly, a Focus view that loses the case). Kill: the measured gate `npm run gate` and the browser journeys fail before a deploy.
- Risk: a release ships with a provider standing in for a producer. Kill: `scripts/check_skeleton.py` lists every row still on a provider and exits 2.
- Risk: the executive view or a page loses its floor. Kill: `frontend/src/content/executive.test.ts`, `frontend/src/content/areas.test.ts` and `scripts/check_sdd.py` fail.

## ADR fit

How Aerovia meets the ADRs it is bound by, and where the base carries the rule (ADR-0078):

| ADR | Rule | Carried by |
|---|---|---|
| ADR-0017 | the documentation areas at their floors and the executive view first | `content/executive.json`, `frontend/src/content/areas.test.ts`, `frontend/src/pages/implementation.test.ts`, `frontend/src/content/methodology-floor.test.ts` |
| ADR-0016 | the shell and content depth | `frontend/src/main.tsx`, `frontend/src/content/primitives.tsx` |
| ADR-0058 | the architecture modal, five themed bilingual diagrams | `frontend/src/content/architecture.ts`, `frontend/public/svg/tech/` |
| ADR-0066 | English first, Spanish in the interface | `frontend/src/content/`, the paired English and Spanish fields of every page and of `content/executive.json` |
| ADR-0067 | no em-dash and no emoji | `scripts/check_content_standards.py` |
| ADR-0069 | method vertical with its acceptance criterion | this SDD, Method ladder; `frontend/src/engine.test.ts`, `tests/python/test_surrogates.py` |
| ADR-0070 | Focus mode for the App: the open group on the 3D scene, `?focus=1`, Escape or the exit button returns to the same case, group and sub-view | `frontend/src/workbench/Workbench.tsx`, `frontend/e2e/groups.spec.ts`, `npm run gate` with `--require-focus` (G18) |
| ADR-0071 | the page is the viewport; one tab row; the drawing at least half the viewport | the shell's `CaseWorkbench`, `frontend/src/workbench/groups.test.ts`, the gate (G5, G6) |
| ADR-0074 | CI runs cheap checks only | `.github/workflows/ci.yml`, `scripts/check_ci_budget.py` |
| ADR-0075 | every requirement names its gate | `docs/design/features/`, `scripts/check_sdd.py` |
| ADR-0078 | rules live in the base | shell 0.15.0 (pinned exactly, 0.16.0 at the release) and the template guards; no product re-implements them |
| ADR-0080 | contract-first parallel delivery: catalog, one schema per boundary, providers, declared states, readiness | `docs/contracts/`, `tests/contracts/`, `scripts/check_contracts.py`, `scripts/check_readiness.py`, `scripts/check_contract_versions.py`, `scripts/check_skeleton.py` |
| ADR-0054, ADR-0055 | compute separation and the Pages deploy, decided at 0.02.000 and unchanged | `deploy/TARGET`, `.github/workflows/deploy-pages.yml`, `docs/architecture/ADR-002-numerical-and-hosting-scope.md` |

# Learned airflow screening

Aerovia implements two trained approximations of its steady ventilation network equations: a separate multilayer perceptron for each calibrated topology and one shared graph network. Their purpose is to compare fast parametric predictions, numerical errors and physical consistency under resistance changes. They do not represent measurements, CFD, gas chemistry or mine safety certification. The reference remains the independently checked nonlinear solver.

The repository contains every stage: input validation, physical preprocessing, seeded datasets and splits, feature extraction, CUDA/CPU training, resumable checkpoints, batch inference, held-out evaluation, model export and release validation. The website consumes those artifacts and additionally runs the exported ONNX models in a local WebAssembly runtime. No model is replaced by a hidden solver call.

## Equations and disclosed nominal calibration

Let `B` be the signed node-edge incidence matrix, with +1 at an airway's source and -1 at its destination. Internal nodes satisfy `B_i q = 0`. Each active branch satisfies

```text
Bᵀp + h₀s² - (R + k)q|q| = 0.
```

Units are m³/s for flow, Pa for pressure and Pa·s²/m⁶ for resistance and fan coefficient. The reference contract fixes boundary pressure explicitly. For the learned case library all boundaries are zero, so `q(s)=s q(1)` and `p(s)=s² p(1)`. This exact relation is applied after unit-speed inference. Zero-speed zero-flow output is a physical control, not learned skill.

Both methods receive one precomputed nominal SciPy solution for each calibrated topology. The nominal flow, pressure and graph descriptors are disclosed calibration inputs. Perturbed test labels are never fed to the network. This is a calibrated surrogate problem; it is not blind transfer to arbitrary unknown mines.

The learned readout predicts a correction `δ` with raw flow

```text
q_raw = q_nominal + max(|q_nominal|, 5 m³/s) δ.
```

A fixed conservation projection gives `q = P q_raw`, where

```text
P = I - B_iᵀ(B_i B_iᵀ)⁻¹B_i.
```

Internal pressure is reconstructed by least squares from the predicted branch losses. These are deterministic matrix operations; no nonlinear reference solve or iterative physical correction takes place during inference. Both raw and projected errors are retained. Float32 inference can leave small numerical mass residuals, which are reported in physical units. Pressure-law residuals remain an independent measure of model approximation error.

## Actual model architectures

| Method ID | Engine | Input and propagation | Output |
|---|---|---|---|
| `topology-mlp` | PyTorch feedforward network, one checkpoint per topology | `E → 128 → 128 → E`; SiLU activations; natural log effective/base resistance in canonical edge order | Flow corrections, fixed projection, pressure reconstruction |
| `graph-surrogate` | Shared PyTorch message-passing network | Hidden width 32; four shared directed edge/node updates; residual step 0.25; source/destination messages and incoming/outgoing mean aggregation | Shared edge readout, the same physical postprocessing |

Graph inputs include log resistance ratio; nominal log resistance; nominal signed flow and stable flow scale; calibrated endpoint pressures; fan pressure/coefficient; airway-role indicators; node boundary flag, calibrated pressure and in/out degree. The graph method uses no arbitrary row-position embedding. A permutation test verifies equivariance after remapping identities. Rendering coordinates, display names, area and target values do not become hydraulic features: they do not alter these equations. Edited area and target do affect the derived velocity and target-deficit diagnostics.

The training loss is projected flow squared error divided by the per-edge stable flow scale, plus 0.1 times raw correction squared error and 0.02 times normalized branch-closure squared error. AdamW uses weight decay 1e-5, gradient clipping at norm 1 and a validation-driven learning-rate reduction. MLP starts at learning rate 0.0015; GNN starts at 0.001. The selected checkpoint has the lowest validation loss. Calibration and test data do not select weights.

This implementation draws on established method families. A mining study used an MLP with simulation-derived training for airflow inference; its observed-mine calibration and published metrics are not Aerovia data. [Zhang et al., 2025](https://doi.org/10.13272/j.issn.1671-251x.2024090057). Physics-informed graph emulation has been demonstrated for water distribution, with stated limitations around small flows, pumps and topology transfer; this supports investigation but does not validate mining fan behavior. [Ashraf et al., AAAI 2024](https://arxiv.org/abs/2403.18570). The message-passing architecture is an established family, not an Aerovia novelty claim. [Gilmer et al., ICML 2017](https://proceedings.mlr.press/v70/gilmer17a.html).

## Data, splits and six operating regimes

All twelve networks are authored engineering inputs. No field measurements, private mine coordinates or operational records are included. Each case has six actual physical variants:

| Regime | Fan speed | Resistance change |
|---|---:|---|
| Design speed | 1 | None |
| Fan turndown | 0.65 | None |
| Fan boost | 1.25 | None |
| Restricted workings | 1 | Working airways ×3 |
| Restricted returns | 1 | Return airways ×3 |
| Distributed resistance | 1 | Every airway ×1.5; fan quadratic coefficient unchanged |

The training dataset is broader than these six replay points. It contains group-correlated and independent branch resistance variations around the regimes, with effective/base ratios bounded to [0.35,5.8]. Each case has 2,048 training, 256 validation, 256 calibration and 256 test vectors: **33,792 total vectors**, including **3,072 held-out test vectors**. Seeds are assigned before generation. All fan-speed derivatives of a resistance vector stay in its original split, and duplicate vector checks run before feature export. There is no learned global normalization that can leak held-out statistics.

The main test measures parameter prediction for known authored topologies. Several cases share generator lineage; random case splitting would not establish unseen-site performance. A separate graph experiment excludes the entire room-and-pillar case from training and validation, fits the same architecture for 200 epochs, and evaluates its 256 held-out perturbations. It receives one disclosed nominal calibration for that excluded topology. The topology MLP has no pretrained output head for that excluded graph; its transfer result is explicitly unsupported. The experiment does not authorize live predictions on unknown graphs.

Labels are generated with the existing batched float64 CUDA nonlinear solver. Every label must pass mass, branch-pressure and fan-delivery gates. Eight fixed samples from every case/split are independently solved with SciPy using identical resistance vectors; all 3,072 held-out test vectors are additionally solved independently with SciPy during full inference. CUDA labels are not mislabeled as if every one originated from SciPy.

## Metrics, calibration and degradation

The same held-out inputs are scored for both learned methods and the independent SciPy reference. Full case × regime × method coverage is mandatory. Report absolute flow MAE/RMSE/max error, pressure error, nodal and branch-law residuals, electrical power error, unsupported predictions and derived target-deficit confusion counts. Shortfall and adequate-flow recalls use their actual counts; absent classes yield null rather than invented perfect recall. A stable normalized flow metric divides each error by `max(|reference flow|,5 m³/s)`. Zero and small flows are retained.

The calibration split determines a maximum-branch-error envelope per case and method at unit speed, using the 95% split-calibration order statistic. The website reports actual held-out coverage. This is not a field-data interval or an out-of-domain guarantee. Scaling it with fan speed follows the stated homogeneous model only.

The degradation experiment injects synthetic resistance-input error:

```text
observed R = true R × exp(σZ - σ²/2), Z ~ N(0,1)
σ ∈ {0, 0.05, 0.15, 0.30}.
```

Both methods receive the same errors on the first 64 held-out vectors per case. True labels remain unchanged. Sigma is lognormal log-space standard deviation; it is not a percentage of measured instrument accuracy. Inputs are not clipped. This offline diagnostic deliberately evaluates extrapolation and counts samples beyond the live domain; browser inference still refuses those inputs.

Timing records identify device, precision, thread count, batch size and scope. Learned timings cover warm model execution plus projection and pressure reconstruction, excluding file/model loading. SciPy timings cover full independent nonlinear solves. Browser loading/verification and inference times are separate. A CUDA-to-CPU ratio is not a model-only speedup, and no latency is a universal guarantee for other hardware.

## Reproduction commands

Use the isolated Python 3.12 GPU environment created by the setup guide, then install the pinned additional dependencies:

```powershell
./scripts/local/01_init.ps1 -Gpu
.venv-gpu/Scripts/python.exe -m pip install -r requirements-surrogates.txt
.venv-gpu/Scripts/python.exe scripts/surrogates.py bake --device cuda
```

The same stages can run individually:

```text
python scripts/surrogates.py ingest --input data/cases.json
python scripts/surrogates.py preprocess
python scripts/surrogates.py dataset --device cuda
python scripts/surrogates.py features
python scripts/surrogates.py train --device cuda
python scripts/surrogates.py infer --inference-device cpu
python scripts/surrogates.py evaluate
python scripts/surrogates.py diagnostics --device cuda
python scripts/surrogates.py export
python scripts/surrogates.py validate
```

Each stage performs its named responsibility; no stage is a placeholder. `build/surrogates` contains intermediate NPZ data, split manifests, features, training histories, best weights and resumable optimizer/scheduler/RNG checkpoints. `train --resume` continues a matching dataset/architecture state. `--method topology-mlp` or `--method graph-surrogate` selects one complete training lane. `--device cpu` executes the same PyTorch method without CUDA, with its actual device recorded.

Paired wrappers are `scripts/train-surrogates.ps1` and `scripts/train-surrogates.sh`. They do not install a background service. Default output is under `build/`. Publishing a scientific release is explicit:

```text
python scripts/surrogates.py export --models-output data/models --science-output data/artifacts/science.json
python scripts/surrogates.py validate --models-output data/models --science-output data/artifacts/science.json
```

The export stage writes model files to a temporary owned directory, verifies them and promotes them with rollback protection. Existing unrelated model files cause rejection. It extends the numerical artifact manifest with the science artifact hash. A later numerical-source change requires a new learned bake and source-identity validation. CI and web deployment must not train, retune or rewrite the canonical benchmark.

## Browser export and domain checks

Current pinned ONNX dependencies are listed in `requirements-surrogates.txt`; browser ONNX Runtime is pinned in the frontend lockfile. Export uses the current PyTorch `dynamo=True` exporter, dynamic batch dimensions and explicit output names. All source-machine stack metadata is removed from the public graph. [PyTorch exporter](https://docs.pytorch.org/docs/main/onnx_export.html), [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html).

Each calibrated topology has its own compact fixed-graph ONNX export for both methods. Input `logResistanceRatios` is float32 `[batch,edgeCount]`; outputs `rawFlows`, `flows`, `pressures` are at unit speed in canonical edge/node order. The graph model's learned weights are shared across those exports. The browser verifies each model's SHA-256, uses one WASM CPU thread and first-party runtime assets, then applies exact speed scaling and recomputes physical scalars. It performs no cloud call or nonlinear correction.

Vite selects the package's `onnxruntime-web-use-extern-wasm` conditional export while preserving Vite's default client conditions. The pinned runtime is served once at `data/ort/ort-wasm-simd-threaded.wasm` with its matching `data/ort/ort-wasm-simd-threaded.mjs` loader. This prevents a second bundled copy of the 13,961,845-byte WASM binary; runtime and models remain loaded on demand from the application's own origin. All 24 exports were exercised through the production workbench after this change, with rendered flow errors agreeing with the actual PyTorch reference, one WASM request, no external requests and no browser errors. See [Vite conditional resolution](https://vite.dev/config/shared-options.html#resolve-conditions) and [ONNX Runtime deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html).

Changed connectivity, node/edge order, airway role, fan curve, boundary pressure, closed edges, unknown network IDs or resistance ratios outside the registry bounds yield an explicit unsupported domain status. Coordinate-only display changes and area/target edits do not falsely become hydraulic inputs. A supplied numerical reference must itself satisfy the current equations before the browser reports prediction errors; stale results cannot become a comparison baseline.

ONNX CPU parity gates are absolute 0.001 m³/s flow and 0.05 Pa pressure, including a separate dynamic single-sample check. The recorded actual differences are available in the registry. `node frontend/verify-learned-browser.mjs` runs all exported methods in actual Chromium WASM on identical fixtures and records evidence under `build/qa/learned-browser.json`. Run `node prepare-data.mjs` from the frontend first to copy the verified artifacts and WASM assets. The rendered workbench and Benchmark tests remain separate visual and interaction gates.

To publish the actual browser receipt with a canonical release, execute the following from the repository root after export. Publishing adds the browser receipt to the owned model manifest and refreshes the science hash in the numerical manifest. Run the final preparation again so the website receives that verified receipt.

```text
node frontend/prepare-data.mjs
node frontend/verify-learned-browser.mjs --publish
python scripts/surrogates.py validate --models-output data/models --science-output data/artifacts/science.json
python scripts/pipeline.py verify --artifacts data/artifacts --input data/cases.json
node frontend/prepare-data.mjs
```

## Executed release evidence

The first scientific release used Python 3.12.10, PyTorch 2.13.0+cu126 and an NVIDIA GeForce RTX 4070 Laptop GPU. The 33,792 float64 CUDA training-label solves completed in 58.33 seconds with zero failed labels and zero duplicate input vectors. All 3,072 independent held-out SciPy checks agreed with the CUDA labels to a maximum absolute flow difference of 1.021e-9 m³/s. Production training took 1,268.43 seconds: twelve topology MLPs each ran 350 epochs, and the shared graph model ran 400 epochs. Best validation checkpoints, rather than the final epoch by default, were exported.

| Held-out measurement | Topology MLP | Shared graph network |
|---|---:|---:|
| Flow MAE, m³/s | 0.06493 | 0.29020 |
| Flow RMSE, m³/s | 0.11200 | 0.46357 |
| Maximum absolute flow error, m³/s | 2.36434 | 8.23233 |
| Pressure MAE, Pa | 1.43488 | 7.26607 |
| Maximum branch-law residual, Pa | 30.65548 | 276.98867 |
| Shortfall recall | 99.772% | 99.586% |
| Adequate-flow recall | 99.712% | 98.736% |

These figures summarize all 3,072 identical held-out inputs. Case and regime cells, class counts and physical residuals remain available in the artifact. The per-case flow-envelope coverage must be read from the actual calibration rows: the return-restriction case's MLP coverage is 89.453%, below the nominal 95%. Calibration does not guarantee finite-sample coverage for every topology in this executed sample.

The separate room-and-pillar family diagnostic ran for 200 epochs in 432.44 seconds and produced a flow RMSE of 1.34076 m³/s on its 256 excluded-topology test inputs. This diagnostic has half the production graph model's epoch budget; the difference in accuracy cannot be attributed solely to topology exclusion. It is a disclosed transfer experiment, and does not expand the live input domain.

Chromium executed all 24 ONNX exports on 48 held-out fixtures. Maximum differences from the original PyTorch output were 0.000091553 m³/s and 0.002686 Pa. Closure, extrapolation and zero-speed controls also passed. The 24 ONNX files total 4,348,376 bytes; each is loaded only when needed. The Python model environment passed 65 tests, including exact checkpoint resumption, physical projection, graph permutation equivariance, split isolation and actual model sensitivity. Separate browser tests exercise domain handling. Timings and checksums in the artifacts are authoritative after any later rebuild.

| Release identity | SHA-256 |
|---|---|
| Canonical source identity | `a8113786ae34930ada58dcb7cc5a97277f9490c7019b256ca579064c801722c8` |
| Scientific artifact including browser evidence | `5a0ab804b168601a80401659043ce3af1e59287f59617f6cba2af8fe5938d91c` |
| Model registry | `bf2b0ea278fad3f96894811bce849d49c6287f73bdfc1e7eb0b97bcbd03cbe4f` |
| Browser receipt | `f94fafb363c255eb4cbe421a164e0c1c6d43d3381ce934a87e35bda47ab67fd8` |

## Public artifacts

- `data/models/registry.json`: method × topology registry, calibration signature, trained cases, input bounds, checkpoint and ONNX hashes, measured export parity.
- `data/models/manifest.json`: exact model/registry/fixture bytes; local machine paths and user information are excluded.
- `data/models/parity-fixtures.json`: original held-out feature vectors and actual PyTorch outputs for independent browser comparison.
- `data/artifacts/science.json`: six physical regimes per case, numerical reference and both model predictions, all held-out metric cells, calibration, degradation, family transfer, training and provenance.
- `data/models/diagnostics/room-pillar-holdout.pt`: the separate topology-family experiment's actual best checkpoint.

The scientific artifact is generated from actual execution. Method names or selectors alone do not establish completeness; missing cells, nonfinite output, source/hash mismatches and export parity failures block a release.

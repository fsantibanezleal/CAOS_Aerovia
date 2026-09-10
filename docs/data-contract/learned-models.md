# Learned model and science contracts

The scientific methods and their limitations are defined in [surrogates](../methods/surrogates.md). This contract describes actual machine-readable artifacts and the browser API.

`aerovia.model-registry/v1` contains one `entries` record for each learned method and calibrated topology. Methods are `topology-mlp` and `graph-surrogate`. Each entry has `networkId`, `version`, `license`, `sourceSha256`, `physicalSha256`, `signature`, `baseResistances`, `factorBounds`, `speedBounds`, checkpoint and ONNX file descriptors, feature shape and measured ONNX parity. File descriptors contain a path relative to `data/models`, SHA-256 and byte count. Paths cannot escape that directory. The signature explicitly records node IDs/order/boundaries, edge IDs/order/endpoints/kinds and fan pressure, coefficient and efficiency.

The registry and science top-level `sourceSha256` identify the canonical network array using the pipeline's deterministic JSON serialization, including authored metadata. This is not the raw JSON file hash and is not a Git commit. Per-entry `sourceSha256` similarly identifies its entire canonical network; `physicalSha256` identifies the calibrated connectivity, roles, fan curves and boundary configuration. Baseline resistances are stored separately because bounded resistance changes are actual model inputs. `implementationAtExport` records the exact seven Python implementation files used for the export, independently of any later frontend build. The website's `release.json` records the current build commit and catalog byte hash; an earlier numerical catalog provenance record remains historical execution evidence and must not be presented as the current application commit.

The fixed exported graph takes `logResistanceRatios:float32[batch,E]`. Ratio means `(overridden or current network R) * global resistanceScale / registered base R`. The browser must reject, not clip, ratios outside the entry's range. ONNX outputs are `rawFlows:float32[batch,E]`, `flows:float32[batch,E]`, `pressures:float32[batch,N]` at unit speed. The browser applies flow × speed and pressure × speed² only after domain validation. Area and targets contribute to derived diagnostics separately.

`aerovia.science/v1` contains:

| Field | Contract |
|---|---|
| `version`, `createdAt`, `sourceSha256` | Scientific release identity, UTC timestamp and aggregate canonical-input hash |
| `methods` | Implemented method IDs, bilingual names, lane and version |
| `regimes` | Six IDs, bilingual names/descriptions and nominal speed |
| `cases` | One record per canonical network, source identity and six regime records |
| `cases[].regimes[]` | `id`, complete `options`, independently solved `reference` and both `predictions` |
| `predictions[methodId]` | `status`, `lane`, `modelVersion`, `rawFlows`, physical `result`, signed `errors` and computed error `metrics` |
| `heldoutFixtures` | One actual test-split sample per case, exact options, independently solved reference and original sample identity |
| `benchmark.rows` | Every case × regime × method held-out metric cell; same input vectors across methods |
| `benchmark.aggregate` | Explicitly sample/edge/node-weighted metrics and measured timing scope |
| `benchmark.calibration` | Per-case/method maximum-error envelope and actual held-out coverage |
| `benchmark.degradation` | Executed synthetic input-error stress aggregates, sigma and out-of-domain counts |
| `benchmark.familyHoldout` | Separate graph family-transfer checkpoint, training exclusions and test metrics |
| `training` | Actual model histories summary, split sizes, seeds, runtime and dataset identity |
| `validation` | Export parity and observed domain/negative controls; browser runtime evidence is separate |
| `provenance` | Authored-data status, licence, calibration inputs and primary method citations |

Every `result` uses the existing `aerovia.result/v1` units and canonical array order. For a surrogate, `converged` only states whether the original physical tolerances happen to be satisfied; it does not indicate whether model inference ran. `status:'supported'` records a completed supported model execution. Approximate finite predictions may have `converged:false`, with their actual residuals visible. They cannot be relabelled as exact reference solutions.

The browser module `frontend/src/learned` exports:

```ts
loadScience(): Promise<ScienceArtifact>
loadRegistry(): Promise<ModelRegistry>
checkDomain(network, options, entry): DomainCheck
predictSurrogate(network, options, methodId, reference): Promise<SurrogateResponse>
```

The reference argument must be a converged numerical solution for the current inputs. The adapter recomputes its physical residuals before comparing errors, without solving or modifying its arrays. Responses have `status` equal to `supported`, `out-of-domain`, `unavailable` or `failed`; `reason`, `methodId`, optional `modelVersion`/`prediction`, and measured diagnostics. A missing or failed model has no prediction arrays and no invented zero error. Model checksums are verified before execution. Assets are hosted under the app's base path at `data/models`, `data/ort` and `data/science.json`.

`LearnedComparison` receives `network`, `options`, numerical `reference`, current selected method ID, language and an `onSelect(result|null,methodId|null)` callback. Selecting an approximate field is explicit. Input changes clear the previously selected prediction. Its optional `onAirwaySelect(id)` links chart selection to the corresponding actual airway.

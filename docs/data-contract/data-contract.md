# Aerovia network and artifact contracts

All inputs use UTF-8 JSON, finite SI values and explicit provenance. The browser accepts one network or one exported project, with a 2,000,000-byte file limit. The offline pipeline accepts one network, an array of networks, or an exported object containing `network`, with a 5 MiB file limit and at most 100 cases. Both enforce the same network schema and per-network graph limits: 120 nodes and 240 edges.

Browser project exports use `aerovia.project/v1` with `{network,options,baseline?,savedAt}`. The CLI preserves imported speed, resistance scale, edited values and closed edges for solve/bake. Optional saved baselines are comparison state and do not change the current solve. Explicit `--speed` or `--resistance-scale` flags take precedence; `--options` JSON takes final precedence. Raw network imports use default options.

## Network: `aerovia.network/v1`

| Field | Meaning / constraints |
|---|---|
| `id` | 1–80 portable characters; starts alphanumeric, remaining alphanumeric or `_ . : -` |
| `name`, `description` | Nonempty `en` and `es` strings, at most 4000 characters each |
| `provenance.kind` | `authored` or `imported` |
| `provenance.source`, `.license` | Nonempty source and reuse-license strings |
| `nodes` | 2–120 unique node IDs |
| `nodes[].x/y/z` | Meters, finite within ±1e6; x/y horizontal, z elevation, negative below surface |
| `nodes[].boundary` | Optional fixed pressure Pa, within ±1e6; at least one node required |
| `edges` | 1–240 unique directed airway IDs; existing, distinct endpoint IDs |
| `edges[].kind` | `intake`, `return`, `working`, `crosscut`, or `fan` |
| `edges[].area` | m², [0.1,1000] |
| `edges[].resistance` | Pa·s²/m⁶, [1e−6,1e6] |
| `edges[].target` | m³/s; 0 disables, positive values [1e−6,10000] |
| `edges[].level` | Presentation grouping within [−100,100] |
| `edges[].fan` | Required exactly when kind is `fan` |
| `fan.pressure` | Nominal shutoff pressure Pa, [0,1e5] |
| `fan.coefficient` | Quadratic coefficient Pa·s²/m⁶, [0,1e4] |
| `fan.efficiency` | Electrical conversion efficiency fraction, [0.05,1] |

The [JSON Schema](network.schema.json) describes structural constraints. Executable validators additionally enforce unique identifiers, endpoint references, positive target minimum, fan-kind coupling and open connectivity to a pressure boundary. Extra metadata fields may be retained; they never execute code or alter equations.

## Options

```json
{
  "speed": 1,
  "resistanceScale": 1,
  "overrides": {
    "airway-id": {"resistance": 0.8, "area": 18, "target": 20, "closed": false}
  }
}
```

`speed` is [0,1.5]; `resistanceScale` is [0.05,20]. All fields default as shown, with empty overrides. Override keys must refer to existing edges and may contain only resistance, area, target and closed. Effective R equals overridden/base R times `resistanceScale`. Closed edges are excluded from the solve but retain their place in output arrays and their target deficits. Imported options cannot isolate a node from all fixed boundaries.

## Result: `aerovia.result/v1`

`flows`, `velocities` and `shortfalls` have exactly the network's edge order; `pressures` has node order. Units are m³/s, m/s, m³/s and Pa respectively. `converged` requires both physical residual acceptance and a supported fan operating regime. `iterations`, `massResidual`, `pressureResidual`, `elapsedMs` and optional `message` expose numerical acceptance. `fanPowerKW`, `totalIntake` and `targetRatio` follow the [method definitions](../methods/ventilation-model.md).

The Python API raises `NetworkError` for malformed input or disconnected closures. The CLI exits 2 and prints an actionable message. A valid but unsupported numerical/fan state returns `converged=false`; the CLI reports failure and retains any previous accepted output. The browser preserves valid current work when it rejects an import. A zero-flow accepted network is possible for zero forcing; it is not used as a substitute for a failed calculation.

Solve and bake write to a temporary sibling directory, verify the complete catalog, then promote the accepted directory. A late failure leaves the previous output byte-for-byte unchanged. Replacement refuses nonempty directories without a matching Aerovia manifest, unowned extra files and symbolic links. This protects unrelated local work and prevents partial release catalogs.

## Published catalog and reproducibility

`data/cases.json` contains the canonical authored inputs. `data/artifacts/catalog.json` uses `aerovia.catalog/v1` with `cases: [{network,options,sourceSha256,optionsSha256,result,ensemble}]` and a measured `benchmark`. Result arrays and ensemble arrays share the same edge order. Source hashes use canonical UTF-8 JSON with sorted keys, compact separators, unescaped Unicode and no NaN; file hashes use exact bytes.

`ensemble` uses `aerovia.ensemble/v1`; its fields and interpretation are documented in [uncertainty](../methods/uncertainty.md). `reference-checks.json` uses `aerovia.reference-checks/v1` and stores fixtures `{networkId,sampleIndex,options,result,batchMaxAbsFlow}`. Each fixture identifies a canonical network and complete sampled resistance overrides. The CPU reference result can be compared to the browser or any independent solver.

`manifest.json` uses `aerovia.manifest/v1` and records SHA-256 and bytes per artifact, engine version, source identity and actual device. Artifact paths are relative and cannot escape the directory. Verification checks bytes, hashes, contracts, conservation recomputed from the exported arrays, derived scalar quantities, dimensions, quantile ordering, probability ranges and the no-failure/parity acceptance gate.

`verify --artifacts data/artifacts --input data/cases.json` additionally confirms that the separate canonical input array matches the networks embedded in the catalog. Catalog and manifest aggregate source identities are checked even without `--input`. Release processing authors a staged source file first, bakes and verifies against it, and then updates the canonical source.

Offline CSV exports contain edge identity, effective edited area/resistance/target, signed flow, velocity, shortfall, closure state and available uncertainty summaries. Browser result CSVs include identity, signed flow, velocity, effective resistance, target, shortfall and convergence residuals; use project JSON to preserve complete current settings and closures. Both use unit-bearing headers. Browser imports stay local; offline processing has no telemetry. Download receipts record bytes and content identity without persisting potentially private URL query strings. The authored public data contains no names, surveyed coordinates, credentials or operating-mine information.

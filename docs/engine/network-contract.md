# Network and intervention contract

The JSON schema identifier is `aerovia.network/v1`. A file is a single object conforming to `frontend/src/contracts.ts`. `validateNetwork(unknown)` returns a cleaned, newly allocated object, strips unknown metadata, and throws a specific message for invalid scientific inputs. It does not clamp values, coerce strings to numbers, or mutate the original object.

## Limits

| Input | Accepted range |
| --- | --- |
| Local import size | At most 2 MiB (the importing UI/script must check before parsing) |
| Nodes | 2–120 |
| Edges | 1–240 |
| Coordinates x, y, z | -1,000,000 to 1,000,000 metres |
| Fixed boundary pressure | -1,000,000 to 1,000,000 Pa |
| Airway area | 0.1–1,000 m² |
| Airway resistance | 0.000001–1,000,000 Pa/(m³/s)² |
| Flow target | 0 (disabled), or 0.000001–10,000 m³/s |
| Level identifier | -100 to 100, numeric |
| Fan shutoff pressure | 0–100,000 Pa |
| Fan quadratic coefficient | 0–10,000 Pa/(m³/s)² |
| Fan efficiency | 0.05–1 |
| Common speed factor | 0–1.5 |
| Global resistance factor | 0.05–20 |

Every numerical value must be finite. Accepted input limits are resource and validation boundaries, not a claim of physical realism or guaranteed conditioning across every combination. Nodes and edges require unique identifiers containing letters, digits, underscore, dot, colon or hyphen, starting with a letter or digit. Identifiers are at most 100 characters; reserved prototype-property names are prohibited. Duplicate parallel branches with different identifiers are valid. Self-loops are rejected. Every edge endpoint must exist, and every node must have an undirected path to at least one fixed-pressure boundary. Multiple separately grounded connected components are supported.

The `name` object on the network and every edge has nonempty `en` and `es` strings, at most 300 characters each. The network `description` has the same language keys with a 10,000-character limit. `provenance.kind` is `authored` or `imported`; `source` is nonempty text of at most 3,000 characters and `license` is nonempty text of at most 300 characters. Provenance is supplied by the file author, not automatically verified. The browser must render these strings as text, never execute them as HTML.

A node is `{ id, x, y, z, boundary? }`. Omit `boundary` for internal junctions; include a finite pressure for boundaries. An edge is `{ id, from, to, name, kind, area, resistance, target, level, fan? }`, where `kind` is `intake`, `return`, `working`, `crosscut` or `fan`. Fan parameters `{ pressure, coefficient, efficiency }` must appear exactly when the edge kind is `fan`.

## Interventions

```json
{
  "speed": 1,
  "resistanceScale": 1,
  "overrides": {
    "working-01": { "resistance": 0.18, "area": 12, "target": 30, "closed": false }
  }
}
```

All three top-level options are required by `validateOptions`; `solveNetwork` alone supplies default options when omitted. Override keys must identify actual network edges. Allowed override fields are only `resistance`, `area`, `target` and boolean `closed`. The same numerical limits as network inputs apply to the override values. Omitted fields retain the network's original values. Unknown edge IDs, typoed fields, null values and numeric strings are rejected. Intervention objects are copied before computation, and neither the network nor the original options are mutated.

Closing an edge excludes its constitutive equation while preserving its place in all output arrays with zero flow/velocity. Positive flow targets retain their input sign and are not removed by closure. The options object intentionally does not set fan efficiency or pressure; edit/import the network to change an underlying fan model, preserving a clear distinction between operating interventions and asset data.

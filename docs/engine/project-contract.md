# Portable projects and local state

`aerovia.project/v1` preserves a network together with the complete operating intervention. Use a project to reproduce a browser state in the local Python processing pipeline. A raw network alone does not preserve fan-speed changes, the global resistance multiplier or closed branches.

```json
{
  "schema": "aerovia.project/v1",
  "network": { "schema": "aerovia.network/v1", "...": "complete network object" },
  "options": {
    "speed": 0.82,
    "resistanceScale": 1.3,
    "overrides": { "working-01": { "resistance": 0.18, "closed": true } }
  },
  "baseline": {
    "network": { "schema": "aerovia.network/v1", "...": "complete baseline network" },
    "options": { "speed": 1, "resistanceScale": 1, "overrides": {} }
  },
  "savedAt": "2026-09-09T00:00:00.000Z"
}
```

The abbreviated network objects above illustrate nesting; download a complete project from the application for executable data. `baseline` is optional. `savedAt` is an ISO UTC timestamp. The network and options use the same validation rules as live computation.

`serializeProject` allowlists the project, network and intervention fields. It keeps scientific inputs and the explicit save timestamp; it adds no original filename, local path, account, device identity or inferred authorship. User-entered names, descriptions and provenance remain part of the model. Exported files therefore contain the data the visitor entered, and the application does not upload them. Device persistence uses only the `aerovia.project.v1` local-storage key; appearance preferences use `aerovia.lang` and `aerovia.theme`.

Derived baseline results are deliberately absent from serialized files. On import or device restore, `validateProject` discards any supplied `baseline.result` and solves the baseline again from its validated network and options. Arbitrary arrays or a forged `converged` field cannot become a comparison result. A malformed or nonconvergent baseline produces an explicit import error. The current intervention itself can be a nonconvergent draft: its settings remain available for repair while a valid baseline remains usable.

`readSaved()` returns a validated project or `null`; inaccessible or corrupt device storage cannot prevent a fresh workspace. `persistProject()` validates and serializes before writing, so malformed inputs leave prior storage intact. Quota/security write failures reach the interface, which can direct the visitor to file export. Appearance storage access is also optional.

The file-size limit is 2 MiB measured in UTF-8 bytes. `parseProject()` checks size before JSON parsing. A file picker should check `File.size` before reading. Objects unknown to the schema are removed, and malformed scientific inputs are rejected rather than silently corrected. CSV downloads quote delimiters/newlines and neutralize formula-like text while preserving signed numeric values.

The local pipeline accepts this complete project as `--input`; imported `options` preserve closures and multipliers. Explicit CLI overrides take precedence when deliberately requested. See [local processing](../guides/02_processing.md) and [GPU ensembles](../guides/03_gpu.md) for supported operations.

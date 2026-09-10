# 02. Create, acquire and process networks

## Data that belongs in this product

Aerovia solves a steady, constant-density pressure network. Nodes define the graph geometry and pressure
boundaries; edges define airways, resistance and fan behavior. Spatial coordinates are in metres and
pressure is in pascals. Flow is in cubic metres per second. Resistance is in Pa/(m³/s)². Converting a survey
requires a measured or calibrated resistance model, meaningful boundary conditions and explicit target
assumptions. A drawing alone does not identify those physical inputs.

The file's `schema` must be `aerovia.network/v1`. Preserve provenance, units, edge orientation and stable
IDs when deriving a network from another system. The detailed source of truth is the
[network data contract](../data-contract/data-contract.md). The validation command rejects malformed
graphs and invalid numeric values; a failing file is never silently repaired or accepted as a solved case.

## Recreate the authored library

The `create` command deterministically regenerates the complete case library. The standard local
wrapper validates it, computes an ensemble with the independent reference pipeline, then verifies its
manifest. By default it writes into ignored `build/local/`, preserving committed release data:

```powershell
./scripts/local/02_generate-data.ps1 -Samples 256 -Seed 20260909
```

```bash
bash scripts/local/02_generate-data.sh --samples 256 --seed 20260909
```

The same operations can be run individually with the CPU interpreter:

```bash
python scripts/pipeline.py create --output build/local/cases.json
python scripts/pipeline.py validate --input build/local/cases.json
python scripts/pipeline.py bake --input build/local/cases.json --device cpu --samples 256 --seed 20260909 --cv 0.15 --output build/local/artifacts
python scripts/pipeline.py verify --artifacts build/local/artifacts --input build/local/cases.json
```

These engineering cases are authored inputs licensed for redistribution, not records of production mine
operation. Their distinct resistance and topology regimes test numerical behavior and support meaningful
interventions. Do not relabel them as observed survey data.

## Bring another network

Export a JSON network from the browser, or prepare one using the contract. Keep private files in an
ignored local folder such as `data/raw/` and confirm the data owner permits processing. The following
uses a file you already have, validates it, solves at nominal fan speed, and writes results outside the
canonical artifact tree:

```bash
python scripts/pipeline.py validate --input data/raw/network.json
python scripts/pipeline.py solve --input data/raw/network.json --speed 1 --resistance-scale 1 --output build/local/my-network
```

`--speed` is a common dimensionless fan-speed multiplier. `--resistance-scale` scales airway resistance.
It does not modify the geometry or turn a uniform parameter change into field calibration. Keep the
original input and intervention parameters beside the results when comparing alternatives.

To download a network from a permitted HTTPS source, first obtain the expected SHA-256 independently
from a trusted publication or data owner, then use:

```bash
python scripts/pipeline.py fetch --url https://data.example.org/network.json --sha256 EXPECTED_SHA256 --output data/raw/network.json
```

Replace both example arguments with the actual source and its 64-character digest. This is a documented
input pattern, not a claimed live data provider. `fetch` checks the response size, checksum and network
schema before retaining it. The CLI limit is 5 MiB; browser imports have a separate 2,000,000-byte limit.
The downloader never requires a credential in the URL and is
intended for public HTTPS datasets; private credentials do not belong in public scripts or logs.

For an existing local file, obtain a digest with `Get-FileHash -Algorithm SHA256 data/raw/network.json`
on PowerShell or `sha256sum data/raw/network.json` on Linux. A hash you compute after an untrusted download
is useful for reproducibility, but does not by itself authenticate that download's origin.

## Read a result, then decide

Examine convergence status and mass/pressure residuals before interpreting airway flow, velocity or fan
power. A mathematically converged network may still omit a leakage branch, use an outdated resistance or
encode a target incorrectly. Preserve failed solver results in the evidence; excluding them from an
ensemble would bias its reported uncertainty.

Compare branch IDs across baseline and intervention, then check each target separately. Lower total fan
power is not sufficient if a critical branch no longer meets its entered target. These targets are design
assumptions, not automatically supplied occupational exposure limits.

## Replace canonical release artifacts deliberately

Use `-Release` (PowerShell) or `--release` (POSIX) only after reviewing the full-case change. The wrappers
always regenerate and bake the entire authored catalog; they do not support partial overwrites of a
release. The CLI computes into a sibling staging directory, verifies the complete artifact set, then
promotes it; a failed bake preserves the previous accepted artifact tree. Nonempty unrelated output
directories are refused. The release wrapper stages generated case inputs under `build/local/` and
copies them to `data/cases.json` only after the bake succeeds. Verification with `--input` also checks
that the external input networks match the catalog and manifest source identity.

GPU release bakes use guide 03. Verify the manifest, inspect the Git diff, rerun solver and browser
checks, and commit the input and all matching outputs together. Deployment only verifies and publishes
those already prepared outputs.

The equations and validity limits are grounded in
[McPherson's ventilation text](https://www.srk.com/download/file/594); the independent numerical lane uses
[SciPy least-squares](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html).

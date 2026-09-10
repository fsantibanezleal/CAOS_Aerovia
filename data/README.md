# Reproducible public data

`cases.json` contains twelve authored Apache-2.0 ventilation network cases, totaling 509 nodes and 656 directed airways. Values and coordinates are explicit engineering assumptions, not operating-mine measurements. The [case guide](../docs/cases/README.md) documents every topology and intervention. Recreate the canonical values with `python scripts/pipeline.py create`.

`artifacts/catalog.json` embeds each source network, solver options, independent SciPy answer and the locally executed CUDA resistance ensemble. `artifacts/reference-checks.json` contains 96 matched resistance realizations with independent answers for browser/reference parity. `artifacts/csv` contains one unit-labelled branch table per case. `artifacts/manifest.json` records exact SHA-256 identities and byte lengths.

Run `python scripts/pipeline.py verify --artifacts data/artifacts` to recompute conservation and verify integrity. Outputs use UTF-8 and LF explicitly, so Git checkout normalization cannot change a published checksum. Timings and creation timestamps vary across reruns; authored input values, seeded draws and accepted numerical values are reproducible within documented floating-point tolerances.

Acquisition is optional: no external dataset, API key or account is needed. `fetch --url <public-https-json> --sha256 <expected-hash> --output <path>` downloads at most 5 MiB, validates content before replacing the target and rejects a checksum mismatch. Use `solve` or `bake --input` with a raw network or an exported `aerovia.project/v1` file to retain edited speed, resistance and closures. Imported local inputs and local outputs belong under ignored `build/local` or `data/raw`, and are not automatically added to the public library.

See [contracts](../docs/data-contract/data-contract.md), [equations](../docs/methods/ventilation-model.md), [uncertainty interpretation](../docs/methods/uncertainty.md), and [executed evidence](../docs/methods/execution-evidence.md).

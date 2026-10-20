# Design: the twelve authored networks and the reader's own

Written on 2026-10-20 from the code and the committed library, after the code (shipped in 0.02.000; the cases became the
cases of the shell's workbench in this release). The longer account is [`docs/cases/README.md`](../../../cases/README.md)
and [`docs/data-contract/data-contract.md`](../../../data-contract/data-contract.md).

- **The library.** `data/cases.json` holds twelve networks (509 junctions and 656 airways in all), generated deterministically
  by `data-pipeline/aerovia_pipeline/cases.py` (`python scripts/pipeline.py create`) with their provenance and the Apache-2.0
  licence of the authored cases. Paired cases keep every unaffected input identical, so the intervention is the only difference.
  Coordinates are metres with Z up; resistance, fan curves and targets are supplied design assumptions.
- **The contract.** The `network` row of the catalog: the schema describes the file (a list) and `$defs.network` one network,
  which the project file, the worker requests and the transport replay carry.
- **In the App.** The twelve networks and the reader's design are the cases of the workbench's selector; the design keeps its
  own category ("Your design"). Each case's write-up is the workbench's Context view (`frontend/src/content/CaseContext.tsx`),
  which ends in one references block. Every case carries six operating regimes in the committed science document.
- **Catalog.** `data/artifacts/catalog.json` holds the reference result and the ensemble of each case, and must list exactly the
  networks of the library.
- **Contracts and tests.** The `network`, `catalog` and `reference-checks` rows; the tests named in `requirements.md`.

# Design: creation, acquisition, verification and promotion

Written on 2026-10-20 from the code, after it (shipped in 0.02.000; the writers validate against the catalog's schemas since
this release). The longer account is [`docs/guides/02_processing.md`](../../../guides/02_processing.md) and
[`docs/methods/execution-evidence.md`](../../../methods/execution-evidence.md).

- **Entry.** `scripts/pipeline.py` runs `data-pipeline/aerovia_pipeline/cli.py` with the commands `create`, `validate`, `fetch`,
  `solve`, `bake`, `verify` and `readiness`. A run stages its output in a temporary folder beside the destination, verifies it
  and only then promotes it; a failure leaves the accepted artifacts unchanged and an output folder the pipeline does not own is
  refused.
- **Acquisition.** `fetch` downloads one checksum-pinned public HTTPS network, rejects credentials and an insecure redirect, and
  validates the network before it writes.
- **Writers.** `write_json` takes a `schema=` argument and validates the document against its file under
  `docs/contracts/schemas/` before it writes (`data-pipeline/aerovia_pipeline/contracts.py`); non-finite numbers are refused.
- **Evidence.** The manifest lists every published artifact by size and digest (`aerovia.manifest/v1`); `verify` re-reads them,
  re-checks conservation and parity, and (with the canonical input) the source identity. The CSV branch tables are a published
  download with no reader in the repository.
- **Readiness.** `python scripts/pipeline.py readiness` computes `data/readiness.json` from the catalog, with no bake and no torch.
- **Contracts and tests.** The rows `network`, `catalog`, `reference-checks`, `branch-table`, `artifact-manifest` and
  `readiness`; the tests named in `requirements.md`.

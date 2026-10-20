- The contract catalog names `frontend/src/lib/contract.test.ts` and `frontend/src/readiness/readiness.test.ts` as
  consumers of the rows they read; `data/readiness.json` and the provider fixtures are regenerated.
- Catalog contract 2.0.0: `ensemble.failedSampleIndices` items are non-negative integers (a constraint added on
  `items`, a major step by the mechanical floor of `check_contract_versions.py`); History entry, lock and the generated
  types (`failedSampleIndices: number[]`) follow. Every committed document already conforms.
- The Implementation page shows every catalog row with its state and reason from `readiness.json` ("What is real in this
  build", Reproducibility topic, both languages), inside the topic's own section with no new navigation row.
- The reader test of the branch-table download skips the generated types file by its path; any other match still fails.
- `docs/methods/surrogates.md` documents the data sequence as `prepare-data.mjs` then `copy-data.mjs`, so
  `public/data/readiness.json` exists.
- A new e2e test measures that with four readiness rows speaking at once every control of the Models pane stays
  reachable at 1280x800 and 390x844 in both languages (the pane scrolls; no container change was needed).
- The routes e2e test scopes its panel locator to the page's own panel, because the Introduction nests sub-tabs.
- UQ-004, OP-004 and TT-010 are caught by their named gates: the ensemble test compares the draws of the batches with the
  unbatched draws, the late-failure test also makes the publishing move fail, and the transport test reads a frame off the
  release end; the strict xfail markers are gone and the TT-010 plant is the row's own defect.
- The adversarial suite is cheap enough for CI: the plants of more than 20 s are narrowed to the input their gate reads or
  carry the `AEROVIA_FULL_PLANTS` marker (local-only, run at release).

# Contract catalog: Aerovia

Phase 2 of contract-first parallel delivery (ADR-0080; rule 11 sections 11 to 20 in CAOS_MANAGE). One row per
boundary of the sizing (B1 to B17) and per model slot. Each schema file under `docs/contracts/schemas/` is the single
source of its contract: the Python producers validate against it before they write (`aerovia_pipeline/contracts.py`, the
`schema=` argument of `write_json`) and in the contract tests, and the TypeScript types are generated from it (U3b). The
executive view (B18) is the shell's contract and the live parity of the browser solver (B19) is a test, so neither is a
row. A change to a contract bumps its row's version and updates both sides in one pull request.

Checks: `python scripts/check_contracts.py docs/contracts/catalog.md --repo-root .` (every field, every path) and
`python scripts/check_skeleton.py docs/contracts/catalog.md` (exit 2 lists the rows still served by a provider;
allowed while a product is being built, never at a release). The readiness document (`data/readiness.json`) is computed
from this file; editing the catalog makes it stale until `python scripts/pipeline.py readiness` runs again
(`scripts/check_readiness.py` fails meanwhile).

Versions and history: a contract's version moves with its schema, by semver (a removed or renamed field, a narrowed
type or a new required field is major; a new optional field is minor; a description or example change is patch), and
every version has a row in the History section below, whose `kind` is the semver step from the contract's previous row
(the first row is `initial`). `docs/contracts/versions.lock.json` holds each schema's version and digest (line endings
normalised to LF); `python scripts/check_contract_versions.py` fails when a schema changed under the same version, when
a version went down, when the lock is not current with the catalog, or when a row has no History entry for its current
version. After a deliberate bump and its History row, run `python scripts/check_contract_versions.py --update` and
commit the lock with the schema and both sides in one pull request.

The lock alone is trusted by that offline check, so a schema change with the lock edited by hand passes it. CI therefore
also runs `python scripts/check_contract_versions.py --base <ref>` (the push's `before` SHA, or `origin/develop`, on a
checkout with `fetch-depth: 0`; a ref it cannot resolve fails, it never passes silently). Against the schemas and the
catalog at that ref it fails when a schema changed and its version is not above the ref's, when the version goes down,
when a change that is breaking by the mechanical floor did not take a major step, and when a contract that had a schema
at the ref has none now without a `major` History row that records the removal. A contract with no row at the ref is a
first release. The mechanical floor is a minimal JSON Schema diff: a removed property, definition or enum value, a
property newly required, a changed const, a narrowed type, an added or tightened bound, pattern or format,
`additionalProperties` turned false or constrained, an added constraint on `items`, `not` or `$ref`, a removed `anyOf` or
`oneOf` alternative and an added `allOf` member. It is the floor and not the judgement: a reviewer still decides the
semantic breaks it cannot see (a changed meaning, a unit, a default value), and a pull request that changes a contract
states its step in the review.

The `documents` column says which committed files a row's schema governs, so that `scripts/check_documents.py` names no
document. A cell is `-` (a contract with no committed document, validated through its `example`) or one or more globs
relative to the repository root, separated by `, ` (`pathlib` glob semantics). The globs under `data/` apply twice, at the
repository root and in the provider tree `docs/contracts/fixtures/`. The model rows (`model-io`, `checkpoint`) declare
`data/models/*/*.onnx` and `data/models/*/*.pt` there: `scripts/check_base_integrity.py` admits a tracked model file only
when a row names it (at most 5 MB each, 50 MB in all), and the committed models are 38 files, 5.72 MB. Binary files and
CSV tables are not JSON: `scripts/check_documents.py` leaves them to their row's producer test (the ONNX input and output
tensors against the registry entry, the checkpoint read without torch, the table header and cells).

Decisions of this catalog:

- `branch-table` (the 12 CSV files) has no reader in the repository. It stays a published download: a row with a producer
  test, and a consumer test that asserts that no source reads the files.
- A network is a list in `data/cases.json`: the schema `network` describes the file and its `$defs.network` one network,
  which the project file, the worker requests and the transport replay carry.
- `engine-worker`, `transport`, `project` and `release-identity` have no committed document. Their `example` and `documents`
  cells point at provider examples under `docs/contracts/examples/`; the static readiness says `missing` for them.
- `model-io` and `checkpoint` are model slots (a `model io` cell). Their baseline provider is the exact SciPy-based solver
  (`aerovia_pipeline/model.py`), which answers when no learned model does.
- `stale` compares the catalog's `benchmark.engineVersion` with the pipeline version (`aerovia_pipeline.__version__`), not
  with the product `VERSION`: the two numbering schemes differ by design and the product version moves without a re-bake.

## Contracts

| id | version | owner | schema file | example | documents | producer test | consumer test | missing-data behavior | provider | model io | swap test | status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| network | 1.0.0 | data-pipeline/aerovia_pipeline/cli.py | docs/contracts/schemas/network.schema.json | docs/contracts/fixtures/data/cases.json | data/cases.json | tests/contracts/test_documents.py::test_document_validates, tests/contracts/test_network.py::test_pipeline_and_schema_agree_on_every_network | frontend/src/engine.test.ts, tests/python/test_io.py | missing: data/cases.json is absent; readiness says missing and the site has no library. partial: a network the catalog lists is absent from cases.json; readiness lists its id and the case selector marks it not available yet | fixture:docs/contracts/fixtures/data/cases.json | - | tests/contracts/test_documents.py::test_document_validates | real |
| catalog | 1.0.0 | data-pipeline/aerovia_pipeline/cli.py | docs/contracts/schemas/catalog.schema.json | docs/contracts/fixtures/data/artifacts/catalog.json | data/artifacts/catalog.json | tests/contracts/test_documents.py::test_document_validates, tests/contracts/test_catalog.py::test_catalog_matches_its_networks | frontend/src/learned/domain.test.ts, tests/python/test_io.py | missing: the catalog is absent; the site build stops at prepare-data and readiness says missing for the bake group (catalog, reference-checks, branch-table, artifact-manifest). stale: benchmark.engineVersion differs from the pipeline version; readiness says stale with both versions | fixture:docs/contracts/fixtures/data/artifacts/catalog.json | - | tests/contracts/test_documents.py::test_document_validates | real |
| reference-checks | 1.0.0 | data-pipeline/aerovia_pipeline/cli.py | docs/contracts/schemas/reference-checks.schema.json | docs/contracts/fixtures/data/artifacts/reference-checks.json | data/artifacts/reference-checks.json | tests/contracts/test_documents.py::test_document_validates, tests/contracts/test_catalog.py::test_reference_checks_refer_to_catalog_networks | frontend/src/engine.test.ts | missing: no bake wrote the reference checks (only a bake does); readiness says missing and the browser parity test is skipped with the reason | fixture:docs/contracts/fixtures/data/artifacts/reference-checks.json | - | tests/contracts/test_documents.py::test_document_validates | real |
| science | 1.0.0 | data-pipeline/aerovia_pipeline/surrogate_export.py | docs/contracts/schemas/science.schema.json | docs/contracts/fixtures/data/artifacts/science.json | data/artifacts/science.json | tests/contracts/test_documents.py::test_document_validates, tests/contracts/test_catalog.py::test_science_refers_to_the_same_sources | tests/contracts/test_models.py::test_the_release_validator_reads_the_science_document | missing: the science document is absent; readiness says missing and the Methodology and Benchmark pages show not available yet with the reason, never an empty chart | fixture:docs/contracts/fixtures/data/artifacts/science.json | - | tests/contracts/test_documents.py::test_document_validates | real |
| branch-table | 1.0.0 | data-pipeline/aerovia_pipeline/io.py | docs/contracts/schemas/branch-table.schema.json | docs/contracts/examples/branch-table-row.json | data/artifacts/csv/*.csv | tests/contracts/test_branch_table.py::test_every_row_of_every_table_matches_the_schema | tests/contracts/test_branch_table.py::test_published_download_has_no_reader_in_the_repository | missing: no tables are committed; readiness says missing. The tables are a published download with no reader in the repository (consumer: none), so nothing else degrades | fixture:docs/contracts/fixtures/data/artifacts/csv/room-pillar.csv | - | tests/contracts/test_branch_table.py::test_every_row_of_every_table_matches_the_schema | real |
| artifact-manifest | 1.0.0 | data-pipeline/aerovia_pipeline/io.py | docs/contracts/schemas/artifact-manifest.schema.json | docs/contracts/fixtures/data/artifacts/manifest.json | data/artifacts/manifest.json | tests/contracts/test_documents.py::test_document_validates, tests/contracts/test_models.py::test_artifact_manifest_lists_the_files_by_identity | tests/python/test_io.py | missing: the manifest is absent; verify stops and readiness says missing. stale: engineVersion differs from the pipeline version; readiness says stale | fixture:docs/contracts/fixtures/data/artifacts/manifest.json | - | tests/contracts/test_documents.py::test_document_validates | real |
| browser-evidence | 1.0.0 | frontend/scripts/verify-learned-browser.mjs | docs/contracts/schemas/browser-evidence.schema.json | docs/contracts/fixtures/data/models/browser-evidence.json | data/models/browser-evidence.json | tests/contracts/test_documents.py::test_document_validates, tests/contracts/test_models.py::test_browser_evidence_refers_to_registered_models | tests/contracts/test_models.py::test_browser_evidence_refers_to_registered_models | missing: the evidence is absent; readiness says missing and the Benchmark page hides the download link and says the browser run is not recorded | fixture:docs/contracts/fixtures/data/models/browser-evidence.json | - | tests/contracts/test_documents.py::test_document_validates | real |
| model-manifest | 1.0.0 | data-pipeline/aerovia_pipeline/surrogate_export.py | docs/contracts/schemas/model-manifest.schema.json | docs/contracts/fixtures/data/models/manifest.json | data/models/manifest.json | tests/contracts/test_documents.py::test_document_validates, tests/contracts/test_models.py::test_model_manifest_lists_every_model_file_by_identity | tests/contracts/test_models.py::test_the_validators_of_the_pipeline_still_accept_the_committed_models | missing: the manifest is absent; the learned models cannot be verified, readiness says missing and the learned methods are not offered | fixture:docs/contracts/fixtures/data/models/manifest.json | - | tests/contracts/test_documents.py::test_document_validates | real |
| model-registry | 1.0.0 | data-pipeline/aerovia_pipeline/surrogate_export.py | docs/contracts/schemas/model-registry.schema.json | docs/contracts/fixtures/data/models/registry.json | data/models/registry.json | tests/contracts/test_documents.py::test_document_validates, tests/contracts/test_models.py::test_registry_entries_agree_with_the_manifest_and_the_networks | frontend/src/learned/domain.test.ts, tests/contracts/test_models.py::test_the_validators_of_the_pipeline_still_accept_the_committed_models | missing: the registry is absent; readiness says missing and the page offers the exact solver only, never a learned answer without its registry entry | fixture:docs/contracts/fixtures/data/models/registry.json | - | tests/contracts/test_documents.py::test_document_validates | real |
| onnx-parity | 1.0.0 | data-pipeline/aerovia_pipeline/surrogate_export.py | docs/contracts/schemas/onnx-parity.schema.json | docs/contracts/fixtures/data/models/parity-fixtures.json | data/models/parity-fixtures.json | tests/contracts/test_documents.py::test_document_validates, tests/contracts/test_models.py::test_parity_fixtures_match_the_registry_widths | frontend/scripts/verify-learned-browser.mjs, tests/contracts/test_models.py::test_parity_fixtures_match_the_registry_widths | missing: the fixtures are absent; the browser model run cannot be repeated, readiness says missing | fixture:docs/contracts/fixtures/data/models/parity-fixtures.json | - | tests/contracts/test_documents.py::test_document_validates | real |
| model-io | 1.0.0 | data-pipeline/aerovia_pipeline/surrogate_export.py | docs/contracts/schemas/model-io.schema.json | docs/contracts/examples/model-io.json | data/models/*/*.onnx | tests/contracts/test_models.py::test_every_onnx_file_has_the_io_its_registry_entry_declares, tests/contracts/test_models.py::test_an_onnx_file_whose_io_differs_from_its_entry_fails | frontend/src/learned/domain.test.ts | partial: an ONNX file the model manifest lists is absent; readiness lists its path and the model is not offered while the other models work. The exact SciPy-based solver always answers (provider baseline) | baseline:data-pipeline/aerovia_pipeline/model.py | in: logResistanceRatios (float32, batch by one value per branch, log of the resistance over its base); out: rawFlows (float32, batch by branch, unit speed), flows (float32, batch by branch, unit speed), pressures (float32, batch by node, unit speed); the graph names and widths equal the registry entry | tests/contracts/test_models.py::test_every_onnx_file_has_the_io_its_registry_entry_declares | real |
| checkpoint | 1.0.0 | data-pipeline/aerovia_pipeline/surrogate_train.py | docs/contracts/schemas/checkpoint.schema.json | docs/contracts/examples/checkpoint.json | data/models/*/*.pt | tests/contracts/test_models.py::test_every_checkpoint_matches_the_checkpoint_schema_and_its_entry, tests/contracts/test_models.py::test_a_checkpoint_missing_a_key_is_rejected_and_a_hostile_pickle_refused | tests/python/test_surrogates.py | partial: a checkpoint file the model manifest lists is absent; readiness lists its path and the model cannot be retrained or exported from it. The browser never reads checkpoints | baseline:data-pipeline/aerovia_pipeline/model.py | dict keys: schema, version, methodId, caseIds, edges (the branch count of the topology), architecture (hidden and steps), seed, epoch, datasetHashes, runtime, stateDict (tensor name to shape and float32), validationLoss | tests/contracts/test_models.py::test_every_checkpoint_matches_the_checkpoint_schema_and_its_entry | real |
| engine-worker | 1.0.0 | frontend/src/engine/worker.ts | docs/contracts/schemas/engine-worker.schema.json | docs/contracts/examples/engine-worker-request.json | docs/contracts/examples/engine-worker-*.json | tests/contracts/test_runtime.py::test_every_runtime_example_validates, tests/contracts/test_runtime.py::test_engine_responses_carry_a_result_or_an_error_never_both_or_neither | frontend/src/engine.test.ts | missing: exchanged at run time; the static readiness says missing. A worker that fails answers {id, kind, error} and the caller rejects with the message; the page keeps working | fixture:docs/contracts/examples/engine-worker-response.json | - | tests/contracts/test_runtime.py::test_every_runtime_example_validates | real |
| transport | 1.0.0 | frontend/src/engine/transport.ts | docs/contracts/schemas/transport.schema.json | docs/contracts/examples/transport-replay.json | docs/contracts/examples/transport-*.json | tests/contracts/test_runtime.py::test_transport_result_and_replay_are_strict, tests/contracts/test_runtime.py::test_transport_frames_keep_the_mass_balance | frontend/src/engine/transport.test.ts | missing: exchanged at run time; the static readiness says missing. A failed run answers {error} or a result with completed false and a message; the page shows the message, never an empty chart | fixture:docs/contracts/examples/transport-response.json | - | tests/contracts/test_runtime.py::test_every_runtime_example_validates | real |
| project | 1.0.0 | frontend/src/storage.ts | docs/contracts/schemas/project.schema.json | docs/contracts/examples/project.json | - | tests/contracts/test_runtime.py::test_the_project_example_is_read_by_the_pipeline_and_the_schema | frontend/src/storage.test.ts, tests/python/test_io.py | missing: written by the App on export; the static readiness says missing. An import that fails the contract is refused with the field named and the saved workspace is kept | fixture:docs/contracts/examples/project.json | - | tests/contracts/test_runtime.py::test_project_with_baseline_validates_and_is_swap_equal_on_both_trees | real |
| release-identity | 1.0.0 | frontend/scripts/prepare-data.mjs | docs/contracts/schemas/release-identity.schema.json | docs/contracts/examples/release-identity.json | - | tests/contracts/test_runtime.py::test_release_identity_is_strict, tests/contracts/test_runtime.py::test_release_identity_matches_what_prepare_data_writes | frontend/scripts/generate-manifest.mjs | missing: written at build, never committed; the static readiness says missing. A build without it stops at generate-manifest | fixture:docs/contracts/examples/release-identity.json | - | tests/contracts/test_runtime.py::test_release_identity_is_strict | real |
| readiness | 1.0.0 | data-pipeline/aerovia_pipeline/readiness.py | docs/contracts/schemas/readiness.schema.json | docs/contracts/fixtures/data/readiness.json | data/readiness.json | tests/contracts/test_readiness.py::test_the_committed_document_is_current | tests/contracts/test_readiness.py::test_the_committed_document_is_current | missing: the document is absent; the site build stops and scripts/check_readiness.py fails. If it cannot be loaded at run time the views keep working and each says readiness unknown | fixture:docs/contracts/fixtures/data/readiness.json | - | tests/contracts/test_readiness.py::test_the_provider_tree_readiness_says_provider | real |

## Missing-data states

One vocabulary for every row (ADR-0080 decision 3). `data-pipeline/aerovia_pipeline/readiness.py` computes each row's
state from this catalog and the repository; the site and the guards show it. Rules, applied in this order, first match
wins:

| Row kind | Condition | state | provenance | reason en | reason es |
|---|---|---|---|---|---|
| any | the catalog `status` is `active` | `provider` | the provider kind | Served by its provider ({provider}); the real producer is not built yet. | Lo sirve su proveedor ({provider}); el productor real aún no está construido. |
| engine-worker, transport, project, release-identity | always, in the static document | `missing` | null | Exchanged at run time or written at build; the static document carries none. | Se intercambia en ejecución o se escribe en la compilación; el documento estático no lo incluye. |
| catalog, reference-checks, branch-table, artifact-manifest | `data/artifacts/catalog.json` is absent | `missing` | null | The pipeline has not baked this build. | El pipeline no ha generado esta versión. |
| network | `data/cases.json` is absent | `missing` | null | The committed document is absent. | El documento versionado no está. |
| network | a network the catalog lists is absent from `data/cases.json` | `partial` | `real` | {n} of {total} networks the catalog lists are absent. | Faltan {n} de {total} redes que lista el catálogo. |
| model-io, checkpoint | a model file of its kind that `data/models/manifest.json` lists is absent | `partial` | `real` | {n} of {total} model files the manifest lists are absent. | Faltan {n} de {total} archivos de modelo que lista el manifiesto. |
| catalog, artifact-manifest | the recorded engine version differs from `aerovia_pipeline.__version__` | `stale` | `real` | Baked by engine {engine_version}; the pipeline is {version}. | Generado por el motor {engine_version}; el pipeline es {version}. |
| any with a committed document | the document (or, for branch-table, every table) is absent | `missing` | null | The committed document is absent. | El documento versionado no está. |
| any | otherwise | `available` | `real` | null | null |

The `status` column holds `real` or `active` only, in lower case; any other value fails the readiness computation (and so
`scripts/check_readiness.py`), because a status the rules do not know would be published as real. `{provider}` is the row's
provider cell (`kind:path`); `{n}`, `{total}`, `{engine_version}` and `{version}` are filled from the repository. `missing`
is a list of strings, non-empty exactly when the state is `partial`: the absent network ids or the absent model paths
relative to `data/models/`, sorted. What each surface does:

| state | the site shows | the guards do |
|---|---|---|
| `available` | the result | pass |
| `partial` | the result for what exists; each absent network or model says not available yet | pass, naming the absent items |
| `stale` | the result and a note with the version that baked it | pass, naming both versions |
| `provider` | the result and a note naming the provider kind | pass while the product is being built, never at a release |
| `training` | the result and a note naming the model that answered (not used by the static document) | pass |
| `missing` | an explicit not available yet with the reason, never an empty chart | pass for the run-time rows; a missing committed document stops the build |

## Providers

- `docs/contracts/fixtures/`: a provider tree in the layout of `data/` (one network, `room-pillar`, its catalog, reference
  checks, science, manifests, registry, parity fixtures, browser evidence, branch table, one tiny ONNX model and its
  checkpoint, and a readiness document that says `provider` for every row). It is generated by
  `tests/contracts/make_fixtures.py` from the committed documents, so it validates against the same schemas; the contract
  tests run against it and against `data/` with the same assertions (the swap tests).
- `docs/contracts/examples/`: one example per run-time row (worker request and response, transport request, response and
  replay, project, release identity) and per tabular or binary row (a branch-table row, a model-io document, a checkpoint
  description).
- `data-pipeline/aerovia_pipeline/model.py`: the baseline of the model slots, the exact SciPy-based network solver. It
  needs no trained model.

A provider is scaffolding: labelled on every surface by the readiness document, never counted as done for the unit that
owes the real producer.

## History

One row per version of every contract, newest last within a contract. `kind` is initial, major, minor or patch, per the
rules above. The rows record the versions this catalog starts from (U3, 2026-10-20); an earlier shape of a contract is not
reconstructed. The generated TypeScript types and the consumer tests of the interface (U3b) read the schema files and
change no version.

| contract | version | date | change | kind |
|---|---|---|---|---|
| network | 1.0.0 | 2026-10-20 | the authored case library: 12 aerovia.network/v1 networks, with the shared options definition | initial |
| catalog | 1.0.0 | 2026-10-20 | the solver catalog: networks, options, SciPy results and the resistance ensemble (aerovia.catalog/v1) | initial |
| reference-checks | 1.0.0 | 2026-10-20 | matched resistance realizations with independent answers (aerovia.reference-checks/v1) | initial |
| science | 1.0.0 | 2026-10-20 | methods, regimes, predictions, benchmark, training and validation evidence (aerovia.science/v1) | initial |
| branch-table | 1.0.0 | 2026-10-20 | the 15-column branch table per case, a published download | initial |
| artifact-manifest | 1.0.0 | 2026-10-20 | SHA-256 and size of every published artifact (aerovia.manifest/v1) | initial |
| browser-evidence | 1.0.0 | 2026-10-20 | every exported ONNX model run in a real browser (aerovia.browser-model-evidence/v1) | initial |
| model-manifest | 1.0.0 | 2026-10-20 | SHA-256 and size of every model file (aerovia.model-manifest/v1) | initial |
| model-registry | 1.0.0 | 2026-10-20 | one entry per method and network with checkpoint, ONNX file, signature and training receipt (aerovia.model-registry/v1) | initial |
| onnx-parity | 1.0.0 | 2026-10-20 | float32 inputs and outputs of each exported model (aerovia.onnx-parity/v1) | initial |
| model-io | 1.0.0 | 2026-10-20 | the input and output tensors of an exported ONNX file, held to its registry entry | initial |
| checkpoint | 1.0.0 | 2026-10-20 | the dict torch.save writes for a trained model, read without torch (aerovia.checkpoint/v1) | initial |
| engine-worker | 1.0.0 | 2026-10-20 | the solver worker request and response by kind | initial |
| transport | 1.0.0 | 2026-10-20 | the transport worker messages, the result (aerovia.transport/v1) and the replay download (aerovia.transport-replay/v1) | initial |
| project | 1.0.0 | 2026-10-20 | the project file the App exports and imports (aerovia.project/v1), 2 MiB limit | initial |
| release-identity | 1.0.0 | 2026-10-20 | version, commit, tree state and digests written at build | initial |
| readiness | 1.0.0 | 2026-10-20 | what is real in a build, row by row, in one of six declared states (aerovia.readiness/v1) | initial |

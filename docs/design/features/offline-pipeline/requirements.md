# Requirements: Offline pipeline: creation, acquisition, verification and promotion

The offline numerical pipeline (`scripts/pipeline.py`, `data-pipeline/aerovia_pipeline/cli.py`, `io.py`, `contracts.py`): case creation, checksum-pinned acquisition, validated writes, manifests and transactional promotion. Written on 2026-10-20 after the code (retroactive).

EARS (Mavin et al., RE'09, doi:10.1109/RE.2009.9). Every requirement names the gate that fails when it is violated.

| ID | Requirement | Gate |
|---|---|---|
| OP-001 | THE pipeline SHALL create the same cases for the same input and round-trip a network through its input file. | `tests/python/test_io.py::test_deterministic_authoring_and_input_roundtrip` |
| OP-002 | IF a document holds a non-finite number, THEN THE pipeline SHALL refuse to write or read it. | `tests/python/test_io.py::test_json_nonfinite_rejected` |
| OP-003 | THE manifest SHALL list every published artifact by size and digest, and verification SHALL detect a tampered file. | `tests/python/test_io.py::test_solver_export_manifest_and_tamper_detection` and `tests/contracts/test_models.py::test_artifact_manifest_lists_the_files_by_identity` |
| OP-004 | IF a later case fails, THEN THE promotion SHALL leave the previously accepted artifacts byte for byte unchanged, and SHALL refuse an output folder it does not own. | `tests/python/test_io.py::test_late_failure_preserves_all_previous_accepted_artifact_bytes` and `tests/python/test_io.py::test_artifact_promotion_refuses_unowned_output_directory` |
| OP-005 | THE acquisition SHALL validate a pinned download by its content digest, SHALL keep the target on a mismatch, and SHALL reject credentials and an insecure redirect. | `tests/python/test_io.py::test_pinned_download_validates_content_and_preserves_target_on_mismatch` and `tests/python/test_io.py::test_download_rejects_credentials_and_insecure_redirect` |
| OP-006 | THE pipeline writers SHALL validate a document against its schema before writing and SHALL name the failing field, writing nothing. | `tests/contracts/test_writers.py::test_a_broken_document_stops_the_write_and_names_the_field` and `tests/contracts/test_writers.py::test_the_catalog_and_manifest_writers_validate` |
| OP-007 | THE verification SHALL detect drift of the canonical input from the one the catalog records. | `tests/python/test_io.py::test_verification_detects_external_canonical_input_drift` |
| OP-008 | IF a command-line parameter is invalid, THEN THE pipeline SHALL refuse it and leave an existing input file unchanged. | `tests/python/test_io.py::test_cli_rejects_invalid_parameters_and_leaves_existing_input` |
| OP-009 | THE branch tables SHALL match their schema row by row and cell by cell, and SHALL stay a published download with no reader in the repository. | `tests/contracts/test_branch_table.py::test_every_row_of_every_table_matches_the_schema` and `tests/contracts/test_branch_table.py::test_a_bad_cell_is_rejected` and `tests/contracts/test_branch_table.py::test_published_download_has_no_reader_in_the_repository` |

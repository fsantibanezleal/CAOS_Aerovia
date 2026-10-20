# Requirements: Static release: the build, the identity and the deployment

The Pages release path: the data preparation and manifest of the build (`frontend/scripts/`), the release identity, the deployed-bytes check and the repository guards that keep a release honest. Written on 2026-10-20 after the code (retroactive, except for the guards added by the base).

EARS (Mavin et al., RE'09, doi:10.1109/RE.2009.9). Every requirement names the gate that fails when it is violated.

| ID | Requirement | Gate |
|---|---|---|
| SR-001 | WHEN the site is built, THE data preparation SHALL stop if the catalog, the science document or a model differs from the size or digest the manifest records. | `frontend/scripts/prepare-data.mjs` |
| SR-002 | THE release identity SHALL be strict and SHALL match what the data preparation writes. | `tests/contracts/test_runtime.py::test_release_identity_is_strict` and `tests/contracts/test_runtime.py::test_release_identity_matches_what_prepare_data_writes` |
| SR-003 | THE deployment check SHALL compare the served bytes and digests with the expected clean revision, over HTTPS only. | `frontend/scripts/verify-deployment.mjs` |
| SR-004 | THE repository SHALL state its version in VERSION, and the package version and the top changelog entry SHALL agree with it. | `scripts/check_version_coherence.py` |
| SR-005 | THE deploy target SHALL be declared in deploy/TARGET, and the repository SHALL carry the files of that place only. | `scripts/check_deploy_place.py` |
| SR-006 | A tracked model file SHALL pass the integrity guard only when a catalog row declares it and it is at most 5 MiB. | `tests/contracts/test_guards.py::test_an_undeclared_model_file_does_not_pass_base_integrity` and `tests/contracts/test_guards.py::test_a_declared_model_over_five_megabytes_fails` |
| SR-007 | THE public-safety guard SHALL fail on a private key, a token, a credential URL, a private workstation path, a personal name or an email address in tracked content, and the vendor-notice guards SHALL fail on an untrusted vendor block. | `scripts/check_public_safety.py` and `tests/python/test_vendor_notices.py::test_untrusted_vendor_block_fails_both_guards` |
| SR-008 | THE CI workflows SHALL trigger only on pushes to develop and main, carry a concurrency group and a timeout for every job, and run no training, bake or test-suite command. | `scripts/check_ci_budget.py` |
| SR-009 | WHEN a reader opens the App route directly, THE site SHALL answer with the App. | `frontend/e2e/routes.spec.ts::a deep link to /app loads the App directly` |

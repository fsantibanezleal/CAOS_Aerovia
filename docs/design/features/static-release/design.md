# Design: the build, the identity and the deployment

Written on 2026-10-20 from the code and the workflows, after the code (the release path shipped in 0.02.000; the guards were
added by the base in this release). The longer account is [`deploy/README.md`](../../../../deploy/README.md) and
[`docs/guides/04_deployment.md`](../../../guides/04_deployment.md).

- **Place.** GitHub Pages, declared in `deploy/TARGET`; no server, database or secret. The compute lane stays offline
  (ADR-0054 and ADR-0055, unchanged).
- **Build.** `npm run build` in `frontend/` type-checks, runs `frontend/scripts/prepare-data.mjs` (it refuses a catalog, a
  science document or a model whose size or digest differs from its manifest, copies the first-party ONNX and WebAssembly
  assets and writes the release identity: version, commit, tree state and the two digests), runs vite, then
  `frontend/scripts/generate-manifest.mjs`, which writes the static manifest of every file and the route entry files for the
  App and the five documentation routes (`frontend/dist`, 124 files).
- **Deploy.** `.github/workflows/deploy-pages.yml` builds a verified revision and publishes it; the cheap checks of the base run
  in `.github/workflows/ci.yml` (ADR-0074). `frontend/scripts/verify-deployment.mjs` compares the served bytes and digests with
  the expected clean revision, over HTTPS.
- **Guards.** `scripts/check_version_coherence.py`, `scripts/check_deploy_place.py`, `scripts/check_base_integrity.py`,
  `scripts/check_public_safety.py`, `scripts/check_ci_budget.py` and the vendor-notice checks keep the release honest.
- **Contracts and tests.** The `release-identity` row of the catalog; the gates named in `requirements.md`.

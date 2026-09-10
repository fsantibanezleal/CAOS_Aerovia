# Static deployment

The production target is GitHub Pages at **https://aerovia.fasl-work.com/**.
The public repository contains the source, licensed cases and verified release artifacts.

| Concern | Implementation |
|---|---|
| Runtime | Static HTML, JavaScript, CSS and local JSON; browser-local computation |
| Build | `npm run build` from `frontend/`, through the pinned npm lockfile |
| Scientific preparation | Local CPU/CUDA scripts; committed artifacts verified before publishing |
| Publish | `.github/workflows/pages.yml`, only a verified `main` revision |
| Identity | No login, account database or application secret |
| Domain | `frontend/public/CNAME` plus the repository Pages custom-domain setting |
| Access | HTTPS; imported networks remain on the visitor's device |

No VPS service, resident GPU, database, container registry or paid API is required for this architecture.
The deployment does not perform a scientific bake. Compute-heavy ensembles run locally, and the browser
loads their checksummed summaries. A future server-side collaboration service would require a new
architecture decision and data-handling design.

Follow [the deployment guide](../docs/guides/04_deployment.md). The paired
`scripts/local/09_deploy.ps1` and `.sh` scripts run actual release gates and can configure Pages and
dispatch its workflow when those options are explicitly selected. They never change DNS or repository
visibility, never reset branches and never install credentials into the source tree.

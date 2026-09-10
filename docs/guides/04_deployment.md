# 04. Publish and verify the app

## Hosting decision

Aerovia publishes static assets and performs live calculations in the visitor's browser. Its release
catalog is baked locally and stored with checksums. This permits a public GitHub Pages deployment
without a resident service, login database, API secret or VPS. Source and release artifacts remain
reviewable together. The default public deployment is an open engineering tool, with no paid account or
commercial transaction flow.

GitHub currently limits a published Pages site to 1 GB and documents a soft bandwidth limit of 100 GB per
month. Aerovia's release target is below 25 MB, providing substantial payload headroom; measure the actual
`frontend/dist/` for each release. Large raw surveys, full sample arrays and CUDA environments are local
processing material and do not belong in the deployed bundle.
Source: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## What triggers a release

`.github/workflows/pages.yml` verifies pull requests and development branches. Only `main` can upload
and deploy the static release. A deployment waits for public-source/history checks, CPU physics tests,
contract/hash validation, TypeScript checks, browser unit tests, a production build and Chromium user
journeys. Actions are pinned to reviewed immutable commit SHAs. The verification job has read-only
repository permission; only the deployment job receives `pages: write` and `id-token: write`.

No workflow downloads a confidential dataset, installs CUDA, runs a scientific bake, uploads visitor
networks or uses a third-party token. The browser build stages an already verified catalog. Failed
verification stops publication. Concurrent development checks may cancel an older check on the same
branch; main releases are allowed to finish rather than being cancelled during publication.

The build/deploy dependency, environment and token permissions follow
[GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Custom subdomain configuration

The production address is **https://aerovia.fasl-work.com/**. Three distinct settings must agree:

| Setting | Value |
|---|---|
| Pages build source | GitHub Actions (`build_type: workflow`) |
| Repository Pages custom domain | `aerovia.fasl-work.com` |
| DNS CNAME for `aerovia` | `fsantibanezleal.github.io` |

The DNS target is the Pages account host, without a path or repository name. The committed
`frontend/public/CNAME` records the intended domain for release tooling. With a custom Actions workflow,
GitHub does **not** use that file to configure the domain: the repository Pages setting is required.
Source: [GitHub custom-domain configuration](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

The local deployment script never changes DNS. For a fork, configure the fork's own domain and update
the CNAME file before using the setup option; do not attempt to claim the production project's domain.

## Release preflight and dispatch

Install [GitHub CLI](https://cli.github.com/) and authenticate through `gh auth login`. Keep authentication
in the CLI's credential storage, outside the public tree. From a clean checkout at the verified
`origin/main` revision, run:

```powershell
./scripts/local/09_deploy.ps1
# One-time Pages setup and an explicit new workflow run:
./scripts/local/09_deploy.ps1 -ConfigurePages -Dispatch
```

```bash
bash scripts/local/09_deploy.sh
# One-time Pages setup and an explicit new workflow run:
bash scripts/local/09_deploy.sh --configure-pages --dispatch
```

The default command verifies the release and reports current Pages/run state. It does not publish.
The setup option creates a Pages binding when absent and records the custom domain; the dispatch option
runs the existing main-branch workflow. Neither option changes repository visibility, commits files,
merges branches, rewrites history or resets a dirty worktree. A normal accepted push to `main` already
triggers the workflow, so a second dispatch is usually unnecessary.

## Confirm the release is actually running

```bash
gh run list --workflow pages.yml --branch main --limit 3
gh run watch RUN_ID --exit-status
gh api repos/fsantibanezleal/CAOS_Aerovia/pages --jq '{html_url,build_type,cname,https_enforced,status}'
```

Replace `RUN_ID` with the run for the exact intended main revision. Check that `headSha` matches that
revision with `gh run view RUN_ID --json headSha,conclusion,url`.

The production build writes `/release.json` containing `version`, `commit`, `workingTreeDirty` and
`catalogSha256`.
`frontend/prepare-data.mjs` reads `VERSION`, obtains the current Git HEAD and verifies the catalog bytes
against its manifest before producing that record. Check the source, version and catalog against the
intended clean checkout, and require a clean build:

```powershell
$release = Invoke-RestMethod 'https://aerovia.fasl-work.com/release.json'
$expectedCommit = (git rev-parse origin/main).Trim()
$expectedVersion = (Get-Content -LiteralPath VERSION -Raw).Trim()
$expectedCatalog = (Get-FileHash -LiteralPath data/artifacts/catalog.json -Algorithm SHA256).Hash.ToLowerInvariant()
if ($release.workingTreeDirty -or $release.commit -ne $expectedCommit -or $release.version -ne $expectedVersion -or $release.catalogSha256 -ne $expectedCatalog) {
    throw 'Deployed source, version or catalog differs from the intended release.'
}
$release
```

On POSIX systems, inspect the same JSON with `curl -fsS https://aerovia.fasl-work.com/release.json`
and compare it with `git rev-parse origin/main`, `cat VERSION` and
`sha256sum data/artifacts/catalog.json`. A successful HTTP response alone does not establish source
identity. A dirty local build also records HEAD, with `workingTreeDirty: true`; publish from the clean
workflow checkout and confirm its matching successful run.

After `npm run build`, its `postbuild` step runs `frontend/generate-manifest.mjs` and writes
`asset-manifest.json`. This records the release identity and each served runtime file's byte count and
SHA-256. It excludes `CNAME`, which configures no runtime behavior, and the asset manifest itself.
Verify the deployed files from `frontend/`, replacing `FULL_GIT_SHA` with the exact intended 40-character
main commit:

```bash
npm run verify:deployment -- https://aerovia.fasl-work.com/ FULL_GIT_SHA
```

The verifier fetches the manifest and every listed file over HTTPS, checks exact bytes and SHA-256,
and fails on an unexpected commit, a dirty build, a redirect to another origin or a total payload over
25 MB. Successful output records the URL, version, commit, verified file/byte counts and catalog hash.
Retain this output with the matching workflow run and browser observations. These checks establish
that the published files match the release manifest; fresh browser QA below establishes behavior and
rendering. Neither substitutes for the other.

Once GitHub has issued the certificate,
enforce HTTPS in Pages settings or run:

```bash
gh api --method PUT repos/fsantibanezleal/CAOS_Aerovia/pages -F https_enforced=true
```

Inspect the actual certificate and domain response after enabling it. Certificate/DNS provisioning is an
external asynchronous step; GitHub documents that HTTPS availability can take up to 24 hours after a new
domain binding. Keep observing the real state and never report a queued certificate as complete.
Source: [GitHub custom-domain HTTPS setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

Check DNS with `Resolve-DnsName aerovia.fasl-work.com -Type CNAME` on PowerShell or
`dig aerovia.fasl-work.com CNAME` on systems with dig. Then open a fresh unauthenticated browser session
at the HTTPS address and exercise a case change, fan-speed edit, airway selection, baseline comparison,
JSON import/export, theme and language change. Inspect desktop and mobile layouts and the console.
An HTTP 200 or a green workflow alone does not establish correct interaction or rendering.

## Rollback and maintain

`Verify live Aerovia` runs daily at 10:17 UTC and can also be dispatched manually. It checks HTTPS,
source revision and every runtime asset, then runs the browser engineering journeys against the public
subdomain. Failures retain diagnostic artifacts in GitHub Actions. This is scheduled verification, not
continuous uptime monitoring or a service-level guarantee. GitHub can disable scheduled workflows in
public repositories after prolonged inactivity; review the Actions schedule when maintaining the app.
See [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Revert the faulty source/artifact change through a reviewed pull request and let the same verified
workflow publish the resulting main revision. Restore a complete matching input/artifact set rather than
mixing files from two bakes. Keep the domain binding intact during a normal rollback. If retiring the
site, coordinate removal of its Pages binding and domain record so the old subdomain is not left dangling.
Revisit the hosting decision when requirements introduce shared state, protected APIs, online heavy
computation, commercial SaaS or a payload that no longer fits this static release boundary.

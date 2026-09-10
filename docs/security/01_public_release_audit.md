# 01. Public release audit

Audit date: 2026-09-09. This record describes the release controls and their exercised scope. The CI
workflow reruns them against each specific revision; its result is the current release gate.

## Source and history

`python scripts/check_public_safety.py --history` passed against the reviewed working tree and all Git
file blobs reachable from the local refs after remote synchronization. The exercised scan reported 103
working-tree paths and 13 historical blobs at that point. Additional source files are checked again in
CI before publication. The configured credential, contact, private-path and personal-attribution patterns
had zero matches. No matched values are emitted by the scanner.

The source boundary deliberately permits the public repository owner identifier in GitHub URLs and the
production domain. Dependency contact metadata is excluded only from the lockfile's contact-address
check; credential rules still inspect the lockfile. Gitignored virtual environments, downloads and
private local calculation outputs are excluded from publication.

This scan covers reachable file history. It does not assert removal of unreachable Git objects, copies
held by other parties or hosting-provider caches, and it does not inspect a hosting account's profile.
Commit attribution is reviewed separately from file content. Pattern scanning also cannot prove that
an arbitrary unrecognized string is not a secret, so source/artifact review remains part of release.

## Executed delivery checks

| Check | Observed result |
|---|---|
| PowerShell prerequisite checker | Node 24.14.1, Python 3.13 CPU and Python 3.12 GPU available; native exit-code handling exercised |
| PowerShell full local CPU bake | 12 cases, 8 draws per case, zero ensemble failures; 14 files and 12 cases verified |
| Git Bash full local CPU bake | Same complete 12-case workflow passed with sandbox outputs |
| PowerShell full local CUDA bake | Actual CUDA device selected; 12 cases, 8 draws each, zero failures; manifest verified |
| Git Bash full local CUDA bake | Same complete CUDA workflow passed; no CPU fallback |
| PowerShell/Bash syntax | Every numbered script parsed successfully |
| Fresh Windows setup | Pinned CPU and frontend dependencies installed in an independent clone-shaped directory; canonical artifacts verified |
| Idempotent setup in both shells | PowerShell and Git Bash completed, preserved existing `.env`, and verified canonical artifacts |
| PowerShell development server | Explicit loopback port started successfully, served HTTP 200 with the correct app title, then stopped cleanly |
| Frontend npm dependency audit | Zero reported vulnerabilities in the audited lockfile |

The eight-draw shell runs validate the command wrappers. They are distinct from the canonical
256-draw-per-case release bake and do not replace its numerical evidence. All wrapper smoke bakes wrote
to ignored `build/local/`; they did not overwrite the committed release catalog.

The static workflow uses pinned official actions, read-only source access during validation and
Pages/OIDC permissions only during publication. It publishes only the built frontend from a fully
verified main revision. No scientific computation, external credential installation or DNS mutation
occurs at deployment.

The release gate additionally matches the external `data/cases.json` networks to the catalog and manifest
source identity. CLI bakes and solves stage and verify complete output before promotion; failed calculations
preserve an accepted existing artifact tree and unrelated nonempty directories are refused.

For the processing evidence, inspect `data/artifacts/manifest.json`, the catalog benchmark and the
[GPU guide](../guides/03_gpu.md). For the public browser's data boundary and reporting channel, see
[security.md](security.md).

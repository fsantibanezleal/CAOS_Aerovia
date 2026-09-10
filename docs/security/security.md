# Public source and local data

Aerovia has no application account, server database, visitor API key or upload endpoint. Imported
networks and interactive edits are processed on the visitor's device. Locally saved browser state can
remain on that device until the user clears it; export anything needed before clearing site storage.
The app's downloaded static files are served by GitHub Pages, whose hosting access logs and platform
policies are separate from application data processing.

The public repository contains authored engineering cases, scientific code, reference results, static
assets, documentation and public dependency metadata. Its public GitHub repository identifier and
production domain are intentional routing metadata. Private mine surveys, workstation paths, personal
contact details, credentials, local `.env` files, virtual environments and raw downloads do not belong
in this repository.

| Boundary | Rule |
|---|---|
| Source tree | Public code and licensed cases only; no personal attribution/contact fields |
| `data/raw/` | Ignored local acquisition area; never staged for a release |
| `build/local/` | Ignored local calculations, including calculations on private input |
| `data/artifacts/` | Reviewed public release results with checksums |
| `.venv/`, `.venv-gpu/` | Ignored local numerical environments |
| `.env` | Ignored; no credentials required by this product |
| GitHub Actions | Temporary built-in token with minimal job permissions; no stored third-party secret |

Run `python scripts/check_public_safety.py --history` before a public push. It scans tracked and
unignored working files and, with the history flag, all reachable historical Git blobs. Configured rules
detect common credential formats, private key files, credential-bearing URLs, private workstation/host
paths, personal attribution and contact addresses. Diagnostics contain paths and rule IDs, never the
matched credential value. Dependency lockfiles can contain public package contact metadata, so the
contact-address rule excludes the lockfile; credential rules still apply there.

This is a deterministic release gate, not a claim that arbitrary secret formats or every form of personal
information can be recognized automatically. Review diffs, artifact provenance and generated outputs
in addition to running the gate. Git author metadata and external account settings require their own
publication review; the scanner inspects file blobs, not account profiles.

If an exposed secret is discovered, use the repository's private vulnerability-reporting channel linked
from [SECURITY.md](../../SECURITY.md). Do not paste the secret into a public issue or diagnostic log.
Removing a file from the latest tree does not remove it from history; revoke the credential at its issuer
and handle historical cleanup through the maintainer's incident process.

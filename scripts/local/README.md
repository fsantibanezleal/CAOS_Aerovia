# Local commands

Run these from the repository root. Both shells resolve the checkout from the script's own location,
so they also work when invoked from another working directory. They select isolated interpreters,
propagate failing native exit codes and require no secrets.

| Number | PowerShell / POSIX filename | Behavior and options |
|---|---|---|
| 00 | `00_install-prereqs.ps1` / `.sh` | Check Node 24, CPU Python 3.13 and Git. `-Gpu` / `--gpu` also checks Python 3.12. PowerShell `-Install` optionally installs missing system tools via winget. |
| 01 | `01_init.ps1` / `.sh` | Create CPU `.venv`, install pinned dependencies and npm lockfile, provision ignored non-secret `.env`. `-Gpu` / `--gpu` selects `.venv-gpu` and CUDA requirements. |
| 02 | `02_generate-data.ps1` / `.sh` | Create all cases, validate, bake and verify. Default output `build/local`; `-Release` / `--release` explicitly writes the complete canonical artifact set. |
| 03 | `03_dev.ps1` / `.sh` | Start development on loopback port 5908. Runs setup if frontend packages are missing. `-Port 5910` / positional `5910` selects another strict port. |
| 04 | `04_preview.ps1` / `.sh` | Build and run production preview on loopback port 4908; same port override. |
| 05 | `05_gpu.ps1` / `.sh` | Require real CUDA availability, then run the full ensemble bake. Options follow 02 except device is always CUDA. |
| 06 | `06_verify.ps1` / `.sh` | Public-source/history audit, numerical tests, artifact checks, typecheck, frontend tests and build. `-Browser` / `--browser` adds Chromium journeys. |
| 09 | `09_deploy.ps1` / `.sh` | Check clean verified main, run release gates, inspect Pages. `-ConfigurePages -Dispatch` / `--configure-pages --dispatch` explicitly sets up Pages and requests publication. |

For 02 and 05, PowerShell flags `-Samples 256 -Seed 20260909 -Cv 0.15` correspond to POSIX
`--samples 256 --seed 20260909 --cv 0.15`. Supported sample counts are 8–8192, seed is an unsigned
32-bit integer, and resistance coefficient of variation is 0–0.75. The default 256-sample run is a
reproducible starting point, not a universal precision guarantee.

Acquisition and imported-network processing use the portable `scripts/pipeline.py` CLI directly:
`create`, `fetch`, `validate`, `solve`, `bake` and `verify`. See
[processing your data](../../docs/guides/02_processing.md) for full commands and provenance requirements.

The `common.ps1` and `common.sh` helpers centralize path/runtime resolution. They are sourced by the
numbered scripts, not additional user workflow stages. POSIX scripts are stored with executable Git
mode; CI checks their mode and Bash syntax. Normal bakes write to ignored `build/local/`, while
deployment only verifies committed artifacts. The full guides are under [docs/guides](../../docs/guides/guides.md).

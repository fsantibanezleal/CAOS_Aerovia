#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
cd "$AEROVIA_ROOT"
environment_name=.venv
python_version=3.13
if [[ "${1:-}" == --gpu ]]; then environment_name=.venv-gpu; python_version=3.12; shift; fi
[[ $# -eq 0 ]] || { printf 'Usage: 01_init.sh [--gpu]\n' >&2; exit 2; }
aerovia_node
if [[ ! -f "$environment_name/bin/python" && ! -f "$environment_name/Scripts/python.exe" ]]; then "python$python_version" -m venv "$environment_name"; fi
python_executable="$(aerovia_python "$environment_name")"
"$python_executable" -c 'import sys; wanted=tuple(map(int,sys.argv[1].split("."))); assert sys.version_info[:2] == wanted, "Recreate environment with Python "+sys.argv[1]' "$python_version"
"$python_executable" -m pip install -r requirements.txt
if [[ "$environment_name" == .venv-gpu ]]; then "$python_executable" -m pip install -r requirements-gpu.txt; fi
if [[ ! -f .env ]]; then cp .env.example .env; fi
(cd frontend && npm ci)
if [[ -f data/artifacts/manifest.json ]]; then
  "$python_executable" scripts/pipeline.py verify --artifacts data/artifacts --input data/cases.json
else
  printf 'Canonical release artifacts absent. Restore data/artifacts from the repository, or explicitly run scripts/local/02_generate-data.sh --release. Then rerun setup.\n' >&2
  exit 1
fi
printf 'Setup complete. Next: bash scripts/local/03_dev.sh\n'

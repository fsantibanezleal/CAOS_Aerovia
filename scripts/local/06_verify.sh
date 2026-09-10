#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
browser=false
if [[ "${1:-}" == --browser ]]; then browser=true; shift; fi
[[ $# -eq 0 ]] || { printf 'Usage: 06_verify.sh [--browser]\n' >&2; exit 2; }
python_executable="$(aerovia_python)"
cd "$AEROVIA_ROOT"
"$python_executable" scripts/check_public_safety.py --history
"$python_executable" scripts/check_content_standards.py
"$python_executable" scripts/check_template_residue.py
"$python_executable" -m pytest tests/python -q
"$python_executable" scripts/pipeline.py validate --input data/cases.json
"$python_executable" scripts/pipeline.py verify --artifacts data/artifacts --input data/cases.json
"$python_executable" scripts/surrogates.py validate --models-output data/models --science-output data/artifacts/science.json
cd frontend
npm run typecheck
npm test
npm run build
if $browser; then npx playwright install chromium; npm run test:e2e; node verify-learned-browser.mjs; fi
printf 'Verification passed. Next: bash scripts/local/04_preview.sh or review scripts/local/09_deploy.sh.\n'

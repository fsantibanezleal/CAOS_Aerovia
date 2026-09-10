#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
device=cpu; samples=256; seed=20260909; cv=0.15; release=false
while (($#)); do
  case "$1" in
    --device) device="${2:?device required}"; shift 2 ;;
    --samples) samples="${2:?samples required}"; shift 2 ;;
    --seed) seed="${2:?seed required}"; shift 2 ;;
    --cv) cv="${2:?coefficient of variation required}"; shift 2 ;;
    --release) release=true; shift ;;
    *) printf 'Usage: 02_generate-data.sh [--device cpu|cuda] [--samples 256] [--seed 20260909] [--cv 0.15] [--release]\n' >&2; exit 2 ;;
  esac
done
[[ "$device" == cpu || "$device" == cuda ]] || { printf 'device must be cpu or cuda\n' >&2; exit 2; }
environment_name=.venv; if [[ "$device" == cuda ]]; then environment_name=.venv-gpu; fi
python_executable="$(aerovia_python "$environment_name")"
cd "$AEROVIA_ROOT"
case_file=build/local/cases.json; artifact_directory=build/local/artifacts
if $release; then case_file=build/local/release-cases.json; artifact_directory=data/artifacts; fi
"$python_executable" scripts/pipeline.py create --output "$case_file"
"$python_executable" scripts/pipeline.py validate --input "$case_file"
"$python_executable" scripts/pipeline.py bake --input "$case_file" --device "$device" --samples "$samples" --seed "$seed" --cv "$cv" --output "$artifact_directory"
"$python_executable" scripts/pipeline.py verify --artifacts "$artifact_directory" --input "$case_file"
if $release; then
  cp "$case_file" data/cases.json
  "$python_executable" scripts/pipeline.py verify --artifacts "$artifact_directory" --input data/cases.json
fi
printf 'Verified artifacts: %s. Next: bash scripts/local/06_verify.sh\n' "$artifact_directory"

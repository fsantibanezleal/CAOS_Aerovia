#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
stage="${1:-bake}"
shift "$(( $# > 0 ? 1 : 0 ))"
default_python='.venv-gpu/bin/python'
if [[ ! -x "$default_python" && -x '.venv-gpu/Scripts/python.exe' ]]; then
  default_python='.venv-gpu/Scripts/python.exe'
fi
python_path="${AEROVIA_SURROGATE_PYTHON:-$default_python}"
if [[ ! -x "$python_path" ]]; then
  printf '%s\n' 'Create the isolated GPU environment and install requirements-surrogates.txt first.' >&2
  exit 2
fi
exec "$python_path" scripts/surrogates.py "$stage" "$@"

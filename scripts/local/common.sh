#!/usr/bin/env bash
set -euo pipefail
AEROVIA_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
export AEROVIA_ROOT
aerovia_python() {
  local environment_name="${1:-.venv}"
  if [[ -x "$AEROVIA_ROOT/$environment_name/bin/python" ]]; then
    printf '%s\n' "$AEROVIA_ROOT/$environment_name/bin/python"
  elif [[ -f "$AEROVIA_ROOT/$environment_name/Scripts/python.exe" ]]; then
    printf '%s\n' "$AEROVIA_ROOT/$environment_name/Scripts/python.exe"
  else
    printf 'Missing %s. Run bash scripts/local/01_init.sh%s\n' "$environment_name" "$([[ "$environment_name" == .venv-gpu ]] && printf ' --gpu' || true)" >&2
    return 1
  fi
}
aerovia_node() {
  command -v node >/dev/null || { printf 'Install Node.js 24 with npm. See scripts/local/00_install-prereqs.sh.\n' >&2; return 1; }
  node -e 'if(Number(process.versions.node.split(".")[0])!==24){console.error("Node.js 24 is required.");process.exit(1)}'
  command -v npm >/dev/null
}

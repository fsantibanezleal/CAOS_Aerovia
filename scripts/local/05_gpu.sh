#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
python_executable="$(aerovia_python .venv-gpu)"
"$python_executable" -c 'import torch; assert torch.cuda.is_available(), "CUDA unavailable. Install a supported NVIDIA driver and run 01_init.sh --gpu. CPU results must not be labelled GPU."; print("CUDA device:", torch.cuda.get_device_name(0))'
exec bash "$AEROVIA_ROOT/scripts/local/02_generate-data.sh" "$@" --device cuda

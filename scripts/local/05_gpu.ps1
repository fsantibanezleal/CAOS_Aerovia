[CmdletBinding()]
param([ValidateRange(8,8192)][int]$Samples = 256, [uint32]$Seed = 20260909, [ValidateRange(0,0.75)][double]$Cv = 0.15, [switch]$Release)
. "$PSScriptRoot/common.ps1"
$pythonExecutable = Get-AeroviaPython -Gpu
Invoke-AeroviaCommand $pythonExecutable @('-c', "import torch; assert torch.cuda.is_available(), 'CUDA unavailable. Install a supported NVIDIA driver and run 01_init.ps1 -Gpu. CPU results must not be labelled GPU.'; print('CUDA device:', torch.cuda.get_device_name(0))")
& "$PSScriptRoot/02_generate-data.ps1" -Device cuda -Samples $Samples -Seed $Seed -Cv $Cv -Release:$Release

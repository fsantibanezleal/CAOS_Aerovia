# 03. Local CUDA uncertainty processing

## What the GPU computes

The GPU lane evaluates many resistance realizations of the same ventilation graph using PyTorch tensor
operations in double precision. Its useful parallelism is across independent realizations. It is not a
trained surrogate, and the repository does not claim that a model checkpoint or training phase exists.
The browser's interactive result remains a separate live solve; a GPU band represents the exact saved
network, seed and parameter distribution identified by its artifact provenance.

Let `cv` be the coefficient of variation of each positive resistance multiplier. A lognormal
parameterization with mean one is

\[
\sigma=\sqrt{\log(1+\mathrm{cv}^{2})},\qquad
M=\exp(-\sigma^{2}/2+\sigma Z),\qquad Z\sim\mathcal N(0,1).
\]

Thus \(E[M]=1\), \(\operatorname{CV}(M)=\mathrm{cv}\), and sampled resistance remains positive. This is an
explicit uncertainty assumption. It does not estimate a survey's measurement distribution or represent
all correlation, leakage, temperature and calibration errors. Check the implementation and manifest for
which resistances and controls are perturbed. Increasing sample count reduces Monte Carlo variability;
it does not correct a misspecified physical model.

## Install an isolated GPU environment

Use Python **3.12** alongside the CPU Python 3.13 installation, an NVIDIA CUDA-capable GPU and a compatible
driver. This is the interpreter used by the executed release bake and its pinned CUDA wheel. The GPU requirements select the pinned CUDA
12.6 PyTorch wheel from the official PyTorch index while other pinned dependencies come from PyPI.
Installing the Python wheel does not install or replace a system graphics driver.

```powershell
./scripts/local/00_install-prereqs.ps1 -Gpu
./scripts/local/01_init.ps1 -Gpu
./scripts/local/05_gpu.ps1 -Samples 256 -Seed 20260909
```

```bash
bash scripts/local/00_install-prereqs.sh --gpu
bash scripts/local/01_init.sh --gpu
bash scripts/local/05_gpu.sh --samples 256 --seed 20260909
```

These use `.venv-gpu/`, preserving `.venv/` for the independent CPU checks. The GPU wrapper verifies
`torch.cuda.is_available()` and reports the CUDA device before dispatch. Missing CUDA produces a failure;
it cannot silently publish CPU output labelled as GPU output. Setup installs frontend packages too so
the environment is usable from a fresh clone.

For direct operation, activate `.venv-gpu` and run:

```bash
python scripts/pipeline.py bake --input data/cases.json --device cuda --samples 256 --seed 20260909 --cv 0.15 --output build/local/gpu-artifacts
python scripts/pipeline.py verify --artifacts build/local/gpu-artifacts --input data/cases.json
```

For a release, add `-Release` or `--release` to `05_gpu`. This explicitly replaces `data/artifacts/` using
the complete authored catalog. Keep the same seed and sample count when reproducing a published bake.
Expect small hardware/library floating-point differences rather than promising byte-identical arrays
across different CUDA devices. Manifest hashes verify the bytes of a particular saved release.

## Independent agreement and failure accounting

For sampled identical realizations, the pipeline compares CUDA flows against the independent SciPy
reference. The release contract requires maximum sampled flow disagreement below \(10^{-4}\) m³/s.
Inspect the stored residuals, number of realizations, solver failures and parity evidence together. CUDA
agreement only establishes agreement with that reference model; it does not constitute mine-site
validation or a guarantee about omitted physics.

All sample failures count in the evidence. Do not drop failed draws and report the remaining distribution
as if every draw converged. Browser uncertainty summaries must remain labelled as the canonical baked
lane when the user edits a network; local edits require a new bake for a corresponding uncertainty claim.

## Capacity and troubleshooting

Start with 256 samples, inspect runtime and memory on your own hardware, then increase only when the
confidence in the reported quantiles benefits. Dense batched graph solves require memory that grows with
batch size and approximately the square of the combined airway-flow and internal-pressure unknowns. Additional airways,
ill-conditioned resistances and difficult operating points also affect iteration cost.

| Symptom | Interpretation and action |
|---|---|
| CUDA unavailable | Check the driver and that `.venv-gpu` contains the CUDA wheel; use CPU mode only as CPU evidence |
| Out of device memory | Reduce sample count or graph size; keep the failed run out of canonical release artifacts |
| High pressure residual | Review conditioning, boundaries and resistance units; do not override convergence checks |
| SciPy/CUDA mismatch | Preserve the exact input, seed and report, reproduce the disagreement and resolve it before release |
| Different quantiles after editing | A different network is a different experiment; compare its input fingerprint and parameters |

References: [PyTorch installation](https://pytorch.org/get-started/locally/),
[batched linear solves](https://docs.pytorch.org/docs/stable/generated/torch.linalg.solve.html),
[PyTorch numerical accuracy](https://docs.pytorch.org/docs/stable/notes/numerical_accuracy.html),
[CUDA availability](https://docs.pytorch.org/docs/stable/generated/torch.cuda.is_available.html).

# Executed local pipeline evidence

The canonical catalog was generated at **2026-09-10T01:14:31Z** (2026-09-09 local session). This receipt reports an executed run, not an estimated benchmark. The current artifact manifest is authoritative if a later rebake changes timing or identity.

```text
python scripts/pipeline.py create
python scripts/pipeline.py bake --device cuda --samples 256 --seed 20260909 --cv 0.15 --output data/artifacts
python scripts/pipeline.py verify --artifacts data/artifacts
python -m pytest tests/python -q
```

CPU tests ran in isolated Python 3.13. CUDA processing ran in a separate isolated Python 3.12.10 environment with NumPy 2.5.3, SciPy 1.18.1 and PyTorch 2.13.0+cu126. CUDA 12.6 executed float64 batched linear systems on an NVIDIA GeForce RTX 4070 Laptop GPU. The environment was populated from package wheels; it does not import another project's packages or require a machine-specific source path. `pip check` reported no broken requirements.

| Measured quantity | Result |
|---|---:|
| Authored cases | 12 |
| Nodes / edges | 509 / 656 |
| Resistance realizations | 3072 (256 per case) |
| Failed realizations | 0 |
| Independent matched-draw SciPy references | 96 (8 per case) |
| Maximum CUDA/SciPy absolute branch-flow difference | 1.181e−11 m³/s |
| Maximum deterministic internal mass residual | 5.685e−14 m³/s |
| Maximum deterministic branch-pressure residual | 9.648e−11 Pa |
| Maximum sampled internal mass residual | 9.948e−14 m³/s |
| Maximum sampled branch-pressure residual | 2.742e−8 Pa |
| Sum of 12 SciPy baseline solve times | 279.14 ms |
| Sum of CUDA batch solve times | 1451.02 ms |
| Pipeline timer including independent parity and exports before final catalog write | 3873.83 ms |
| Artifact bytes including manifest and CSV | 1,638,784 |

The timer starts after Python module imports; it is not a cold-process startup benchmark. These small networks do not establish a universal GPU speedup. GPU processing is used for a reproducible ensemble and verified as actual CUDA execution, without a learned-model claim.

The Python suite passed **51 tests**, covering analytic truth, four speeds over all authored cases, graph failures, import/export integrity, external source drift, pinned downloads, project-option retention, chunked ensembles, transactional artifact promotion and CPU/reference agreement. A deliberately failing later case leaves a previous accepted catalog byte-for-byte unchanged. Separately, the browser engine is compared to the 12 baseline results and matched-draw fixtures in its own test suite. The benchmark table here reports only the pipeline's own measured numerical evidence.

Input file SHA-256: `b2af5a35d4908292a2a35abdd19ad81232d97f6011dcabeec91c7b9d31c8e6b9`.

The real HTTPS `fetch` command also downloaded the 268,641-byte canonical input from the public repository's immutable commit `860ae0dd2a2355150041039701f1a000ea1392c5`. The required checksum above matched, and the importer validated all twelve networks before writing the local acquisition output. This exercises the actual network download path in addition to the rejection tests; no third-party dataset or credential is required.

Catalog file SHA-256: `8270bb4688592720c0b0208514916ebe0889236872b0f40d77788d4d8f304a85`.

All 16 canonical data/artifact files were checked for LF-only output; raw and Git-filtered blob identities matched. The artifact verifier validated 14 manifest-listed payload files and 12 physical network results. Numerical verification does not establish field calibration, measured savings or suitability for direct ventilation control.

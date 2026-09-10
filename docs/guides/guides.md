# Guides

Aerovia is a local engineering workbench for inspecting and changing underground ventilation networks.
Its web application, independent reference solver and optional CUDA processing scripts use the same
versioned network contract. The authored case library is a reproducible engineering input set, with
explicit provenance; it is not a collection of confidential mine surveys.

| Task | Guide |
|---|---|
| Start a fresh clone and run the release checks | [01 Local installation and execution](01_local.md) |
| Create, download, validate and process a network | [02 Processing your data](02_processing.md) |
| Compute reproducible GPU resistance ensembles | [03 GPU processing](03_gpu.md) |
| Publish and verify the static app on its custom domain | [04 Deployment](04_deployment.md) |
| Understand what the public repository and browser store | [Public data boundary](../security/security.md) |

The paired scripts are indexed in [scripts/local/README.md](../../scripts/local/README.md).
Direct Python commands below assume the appropriate virtual environment is active. Using the numbered
scripts avoids activation and selects the right interpreter explicitly.

- Planted-defect tests for the engine features (airflow-and-fans, network-cases, uncertainty, learned-screening, offline-pipeline): 45 tests under
  `tests/adversarial/`, each planting its row's defect in a throwaway copy and running the requirement's own gate there (pytest, vitest or a
  Playwright journey); the vitest and browser plants skip where node, the install or a browser is absent.
- Two rows are marked `xfail(strict)` because their named gate cannot fail (UQ-004, OP-004); the report lists the evidence.

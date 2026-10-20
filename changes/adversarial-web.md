- The planted-defect suite of the web, design, transport and release features: 48 tests under `tests/adversarial/`
  (`test_base_0_08_refuted.py` 16, `test_design_refuted.py` 11, `test_tracer_transport_refuted.py` 12,
  `test_static_release_refuted.py` 9), one per validation row. Each plants the row's defect in a throwaway copy and runs the
  requirement's own gate on it: the frontend's vitest tests, the Python contract and vendor tests, the guards under
  `scripts/`, `prepare-data.mjs` and `verify-deployment.mjs`, or a Playwright journey; each also passes on the clean copy.
  The vitest and browser plants skip when node, the installed frontend or a Playwright browser is absent.
- CI now runs `scripts/check_tech_matrix.py`, `scripts/check_sdd.py` and `python -m pytest tests/adversarial -q`; the pytest
  pin moves from 8.4.2 to the template's 9.1.1, in `requirements.txt` and in the SDD technology table together.

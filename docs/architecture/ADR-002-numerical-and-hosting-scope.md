# ADR-002: verified network computation and static hosting

Status: accepted, 2026-09-09; expanded by [ADR-003](ADR-003-shared-spatial-workspace.md) on 2026-09-10 for actual tracer transport and learned screening. The original no-training scope below is historical; the static hosting and independent-reference decisions remain current.

Use a constant-density, isothermal pressure network. The live browser method is damped nodal Newton; SciPy least-squares is the independent offline reference; PyTorch CUDA batches resistance uncertainty. No learned model is promised, so there is no nominal training stage. Full input validation, scientific evaluation, artifact export and checksums remain required. Do not label numerical agreement as field validation.

The browser performs interactive computation on local data. Heavy Monte Carlo results are baked offline, carrying their exact inputs and provenance. No backend, login, visitor API key or upload is necessary. Deploy the public repository through GitHub Actions to GitHub Pages. The VPS is unnecessary for the selected computation boundary. Revisit only if a future requirement needs server secrets, shared persistence or large server-side jobs.

References: [McPherson, chapters 5, 7 and 10](https://www.srk.com/download/file/594), [SciPy least-squares](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html), [PyTorch batched solve](https://docs.pytorch.org/docs/stable/generated/torch.linalg.solve.html), [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

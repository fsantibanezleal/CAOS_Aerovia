- The five documentation pages sit on the shell's `DocPage` and `DocSection`. Every section declares its area from its
  page's vocabulary (ADR-0017 section 2.1) and a method also its kind, classical or learned. The shell draws one
  references block at the end of each page or open topic, so the per-section reference rows are gone.
- The Introduction opens on the executive view (the shell's `ExecutiveView`, fed by `content/executive.json`) and has a
  technical view of five topics: the problem, the principles, the mathematics, the pipeline, and the scope and limits.
  The symbols are the shell's glossary and the steps are the pipeline area's ordered list; the pipeline figure gained a
  caption. No equation or glossary shows while the executive view is open.
- The citations are split per page under `frontend/src/content/citations/`; `citations.ts` keeps the shared ones and
  composes the same list in the same order. A page unit adds its own citations in its own file.
- New tests: the area map and the Introduction's floors in both languages, the citation split, the render of every page
  and of every section, and an end-to-end check that each open topic ends with exactly one references block.

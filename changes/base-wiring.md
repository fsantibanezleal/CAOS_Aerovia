- The product runs on the shared shell 0.15.0, pinned exactly (it was 0.6.8). The footer licence, the repository
  visibility and the contained frame are set through the shell's current options; the architecture diagrams are
  inline SVG, as the shell requires.
- The header order is the shell's: App, Introduction, Methodology, Implementation, Experiments, Benchmark. The App is
  at `/app`; `/` and every unknown path open the Introduction, and an old App link such as `/?case=room-pillar` is
  forwarded to `/app` with its query string and its hash kept. `/app` answers 200 on Pages like the other routes.
- The App's frame is the shell's surface page: its tool rows and the case selector sit in the surface head, the six
  modes are the surface views, and the product no longer restyles shell classes. Below 900 px the page scrolls as a
  whole, as the shell defines it, and the instrument keeps a readable height. The product's own focus view stays.
- Numbers in views follow the interface language (a decimal comma in Spanish), and the airflow stream and the transport
  playback run on the shell's paused-by-default frame loop.
- The Implementation page shows six stage tabs instead of eight: the inputs with their geometry, and the two solvers,
  share a tab each; every section is still shown.
- The product's scripts moved under `frontend/scripts/` (`prepare-data`, `generate-manifest`, `verify-deployment`,
  `verify-learned-browser`, `screenshot`), and `npm run gate` runs the shell's measured gate on the build.
- The template 0.08.002 guards that apply now run in a new CI workflow: version coherence, deploy place, SVG
  animation, web baseline, template residue, document paths, content standards and CI budget. The Pages workflow is
  `deploy-pages.yml`. `product.json`, `.template-version` and `deploy/TARGET` record the product and the template it follows.

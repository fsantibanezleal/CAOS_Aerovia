# Visual verification: 0.02.001

This release addresses the rejected static-scene presentation. The main instrument now renders a continuous flow field from the solved signed airway flows. Each airway carries moving particles whose direction follows the computed sign; tracer mode recolors the particles from the selected transport frame. Fan rotor animation is driven by the corresponding solved flow magnitude. The `LIVE AIRFLOW` marker is shown only after a converged result exists.

The animation is deliberately paused as a second continuous renderer while a transport frame is active. Timeline changes repaint the scene from the selected frame and leave the worker and slider responsive. The stream resumes when the scene returns to the solved airflow view.

Evidence:

- `npm run typecheck`
- `npm run test -- --run` (312 tests)
- `npm run build`
- `npm run test:e2e -- --reporter=line` (35 tests)
- `e2e/presentation.spec.ts`, `the solved instrument exposes a continuously animated airflow stream`
- `e2e/scientific-boundaries.spec.ts`, real worker pulse and scheduled fan stop

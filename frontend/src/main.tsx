import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { Wind } from "lucide-react";
import {
  AppShell,
  applyTheme,
  readTheme,
  CitationsProvider,
  Landing,
  STANDARD_ROUTES,
  useShellLang,
  type ShellConfig,
} from "@fasl-work/caos-app-shell";
import "@fasl-work/caos-app-shell/styles.css";
import "./aerovia.css";
import { CONTENT_CITATIONS } from "./content/citations";
import { ROUTE_TABLE, type PageName } from "./routes";
import Workbench from "./workbench/Workbench";
const Introduction = React.lazy(() => import("./pages/Introduction"));
const Methodology = React.lazy(() => import("./pages/Methodology"));
const Implementation = React.lazy(() => import("./pages/Implementation"));
const Experiments = React.lazy(() => import("./pages/Experiments"));
const Benchmark = React.lazy(() => import("./pages/Benchmark"));
import { ARCHITECTURE } from "./content/architecture";
applyTheme(readTheme());
const config: ShellConfig = {
  product: { name: "Aerovia", mark: <Wind size={18} /> },
  version: __APP_VERSION__,
  // Every route is the viewport (ADR-0071 rule 1): the workbench fills it and a documentation route scrolls inside
  // the main container. It replaces the `fixed` option of 0.6.x.
  contain: true,
  architecture: ARCHITECTURE,
  // The shell's header order: App, Introduction, Methodology, Implementation, Experiments, Benchmark.
  routes: STANDARD_ROUTES,
  links: { github: "https://github.com/fsantibanezleal/CAOS_Aerovia" },
  // Required since shell 0.7.0: the footer shows the product's own licence, never a default.
  license: { en: "MIT licence", es: "Licencia MIT" },
  visibility: "public",
  footer: {
    attribution: false,
    provenance: {
      en: "Authored networks · local computation",
      es: "Redes construidas · cálculo local",
    },
  },
};
// The document declares the language it is written in, on every route. The shell never writes it
// (CAOS_MANAGE conventions/shell-known-defects.md, entry 4) and only the workbench hook did, so the
// five content routes declared lang="en" in Spanish until 0.03.000.
function DocumentLanguage(): null {
  const lang = useShellLang();
  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="page-body prose">
        <h1>Aerovia</h1>
        <p>
          The workspace could not load. Reload to recover the saved project.
        </p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
// The landing: `/` and every unknown path render <Landing />, which opens /introduction and forwards an old App link
// such as /?case=B2 to /app?case=B2 (query string and hash kept). The path table is routes.ts.
const ELEMENT: Record<PageName, React.ReactNode> = {
  landing: <Landing />,
  app: <Workbench />,
  introduction: <Introduction />,
  methodology: <Methodology />,
  implementation: <Implementation />,
  experiments: <Experiments />,
  benchmark: <Benchmark />,
};
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <BrowserRouter>
      <CitationsProvider items={CONTENT_CITATIONS}>
        <AppShell config={config}>
          <DocumentLanguage />
          <React.Suspense
            fallback={
              <div className="page-body prose" role="status">
                Loading / Cargando…
              </div>
            }
          >
            <Routes>
              {ROUTE_TABLE.map((r) => (
                <Route key={r.path} path={r.path} element={ELEMENT[r.page]} />
              ))}
            </Routes>
          </React.Suspense>
        </AppShell>
      </CitationsProvider>
    </BrowserRouter>
  </Boundary>,
);

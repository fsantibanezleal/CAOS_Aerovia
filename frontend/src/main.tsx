import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { Wind } from "lucide-react";
import {
  AppShell,
  applyTheme,
  readTheme,
  CitationsProvider,
  useShellLang,
  type ShellConfig,
} from "@fasl-work/caos-app-shell";
import "@fasl-work/caos-app-shell/styles.css";
import "./aerovia.css";
import { CONTENT_CITATIONS } from "./content/citations";
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
  fixed: true,
  architecture: ARCHITECTURE,
  routes: [
    { path: "/", en: "App", es: "App" },
    { path: "/introduction", en: "Introduction", es: "Introducción" },
    { path: "/methodology", en: "Methodology", es: "Metodología" },
    { path: "/implementation", en: "Implementation", es: "Implementación" },
    { path: "/experiments", en: "Experiments", es: "Experimentos" },
    { path: "/benchmark", en: "Benchmark", es: "Benchmark" },
  ],
  links: { github: "https://github.com/fsantibanezleal/CAOS_Aerovia" },
  footer: {
    attribution: false,
    license: { en: "MIT", es: "MIT" },
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
              <Route path="/" element={<Workbench />} />
              <Route path="/introduction" element={<Introduction />} />
              <Route path="/methodology" element={<Methodology />} />
              <Route path="/implementation" element={<Implementation />} />
              <Route path="/experiments" element={<Experiments />} />
              <Route path="/benchmark" element={<Benchmark />} />
              <Route path="*" element={<Workbench />} />
            </Routes>
          </React.Suspense>
        </AppShell>
      </CitationsProvider>
    </BrowserRouter>
  </Boundary>,
);

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Wind,
  Box,
  ChartNoAxesCombined,
  Network as NetworkIcon,
  BookOpen,
  Sun,
  Moon,
  Globe,
  Code2,
  Info,
  ArrowUpRight,
  RotateCcw,
  Play,
  Pause,
  Layers,
  LocateFixed,
  Save,
  Upload,
  Download,
  Undo2,
  Redo2,
  SlidersHorizontal,
  X,
  Check,
  ArrowRight,
  Search,
  Plus,
  ChevronDown,
} from "lucide-react";
import type {
  Network,
  Options,
  Result,
  CurvePoint,
  SensitivityPoint,
  OptimizationResult,
} from "./contracts";
import { DEFAULT_OPTIONS, validateNetwork, validateOptions } from "./engine";
import useEngine from "./useEngine";
import {
  download,
  csvCell,
  persistProject,
  readSaved,
  serializeProject,
  validateProject,
  readPreference,
  type Project,
} from "./storage";
import type { Metric } from "./scene/NetworkScene";
import Dialog from "./components/Dialog";
import Evidence from "./components/Evidence";
import Architecture from "./components/Architecture";
import AnalysisView, { type AnalysisEnsemble } from "./components/AnalysisView";
import NetworkView from "./components/NetworkView";
import Numeric from "./components/Numeric";
import { formatNumber as number } from "./presentation";
const NetworkScene = lazy(() => import("./scene/NetworkScene"));

type Catalog = {
  cases: { network: Network; result: Result; ensemble?: AnalysisEnsemble }[];
  benchmark: unknown;
};
type Snapshot = { network: Network; options: Options };
type Baseline = { network: Network; options: Options; result: Result };
const clone = <T,>(v: T): T => structuredClone(v);

export default function App() {
  const [lang, setLang] = useState<"en" | "es">(() =>
    readPreference("lang") === "es" ? "es" : "en",
  );
  const b = (en: string, es: string) => (lang === "en" ? en : es);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = readPreference("theme");
    return saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  });
  const [focus, setFocus] = useState(false),
    [architecture, setArchitecture] = useState(false),
    [envelope, setEnvelope] = useState(false),
    [cut, setCut] = useState(0.4);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [network, setNetwork] = useState<Network | null>(null),
    [options, setOptions] = useState<Options>(clone(DEFAULT_OPTIONS)),
    [result, setResult] = useState<Result | null>(null);
  const [resultInput, setResultInput] = useState<Snapshot | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [page, setPage] = useState<
      "workspace" | "analysis" | "network" | "evidence"
    >("workspace");
  const [metric, setMetric] = useState<Metric>("route"),
    [view, setView] = useState<"space" | "plan">("space"),
    [separation, setSeparation] = useState(0.25),
    [level, setLevel] = useState<number | null>(null),
    [paused, setPaused] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [cameraReset, setCameraReset] = useState(0);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [analysisBusy, setAnalysisBusy] = useState(false),
    [curveData, setCurveData] = useState<CurvePoint[]>([]),
    [sensitivityData, setSensitivityData] = useState<SensitivityPoint[]>([]),
    [optimum, setOptimum] = useState<OptimizationResult | null>(null);
  const [dialog, setDialog] = useState<"import" | "edit" | null>(null),
    [draft, setDraft] = useState(""),
    [search, setSearch] = useState(""),
    [mobileControls, setMobileControls] = useState(false),
    [mobileInspector, setMobileInspector] = useState(false);
  const [hours, setHours] = useState(8000),
    [tariff, setTariff] = useState(0.12);
  const [history, setHistory] = useState<Snapshot[]>([]),
    [future, setFuture] = useState<Snapshot[]>([]);
  const request = useEngine();
  const revision = useRef(0),
    analysisRevision = useRef(0);
  const inputFile = useRef<HTMLInputElement>(null);
  const hasLoaded = useRef(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("aerovia.theme", theme);
      localStorage.setItem("aerovia.lang", lang);
    } catch {}
  }, [theme, lang]);
  useEffect(() => {
    let alive = true;
    fetch("/data/catalog.json")
      .then((r) => {
        if (!r.ok) throw new Error("The case catalog could not be loaded.");
        return r.json();
      })
      .then((data: Catalog) => {
        if (!alive) return;
        if (!data.cases?.length) throw new Error("Empty case catalog");
        data.cases.forEach((c) => validateNetwork(c.network));
        setCatalog(data);
        const saved = readSaved();
        let initial = data.cases[0].network;
        let settings = clone(DEFAULT_OPTIONS);
        if (saved) {
          try {
            initial = validateNetwork(saved.network);
            settings = validateOptions(saved.options, initial);
            setBaseline(saved.baseline ?? null);
          } catch {
            initial = data.cases[0].network;
          }
        }
        setNetwork(initial);
        setOptions(settings);
        setSelected(
          initial.edges.find((e) => e.kind === "working")?.id ??
            initial.edges[0].id,
        );
        hasLoaded.current = true;
      })
      .catch((e) => setError(String(e.message)));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!network) return;
    const ticket = ++revision.current;
    ++analysisRevision.current;
    setOptimum(null);
    setCurveData([]);
    setSensitivityData([]);
    setBusy(true);
    const timer = setTimeout(() => {
      request<Result>("solve", network, options)
        .then((r) => {
          if (ticket !== revision.current) return;
          setResult(r);
          setResultInput({ network, options });
          setError(
            r.converged
              ? ""
              : (r.message ??
                  b("The model did not converge.", "El modelo no convergió.")),
          );
        })
        .catch((e) => {
          if (ticket === revision.current) setError(e.message);
        })
        .finally(() => {
          if (ticket === revision.current) setBusy(false);
        });
    }, 100);
    return () => clearTimeout(timer);
  }, [network, options]);
  useEffect(() => {
    if (!network || !hasLoaded.current) return;
    const timer = setTimeout(() => {
      try {
        persistProject({
          schema: "aerovia.project/v1",
          network,
          options,
          baseline: baseline ?? undefined,
          savedAt: new Date().toISOString(),
        });
      } catch {
        setNotice(
          b(
            "Device storage is full. Export a project to preserve your work.",
            "Almacenamiento lleno. Exporte el proyecto para conservar su trabajo.",
          ),
        );
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [network, options, baseline]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  const effective = useMemo(
    () =>
      network
        ? {
            ...network,
            edges: network.edges.map((e) => ({
              ...e,
              ...options.overrides[e.id],
            })),
          }
        : null,
    [network, options],
  );
  const selectedIndex =
      network?.edges.findIndex((e) => e.id === selected) ?? -1,
    edge = effective?.edges[selectedIndex];
  const closed = useMemo(
    () =>
      new Set(
        Object.entries(options.overrides)
          .filter(([, v]) => v.closed)
          .map(([k]) => k),
      ),
    [options],
  );
  const chosenCase = catalog?.cases.find((c) => c.network.id === network?.id);
  const matchesBake =
    !!network &&
    !!chosenCase &&
    JSON.stringify(network) === JSON.stringify(chosenCase.network) &&
    JSON.stringify(options) === JSON.stringify(DEFAULT_OPTIONS);
  const baselineValid =
    !!network &&
    !!baseline &&
    network.edges.length === baseline.network.edges.length &&
    network.edges.every((e, i) => e.id === baseline.network.edges[i].id);
  const levels = [
    ...new Set(
      network?.edges.filter((e) => e.kind === "working").map((e) => e.level) ??
        [],
    ),
  ].sort((a, b) => a - b);
  const filtered =
    effective?.edges.filter((e) =>
      `${e.id} ${e.name[lang]} ${e.kind}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  function snapshot() {
    return { network: clone(network!), options: clone(options) };
  }
  function change(
    nextNetwork: Network = network!,
    nextOptions: Options = options,
  ) {
    try {
      validateNetwork(nextNetwork);
      validateOptions(nextOptions, nextNetwork);
      setHistory((h) => [...h.slice(-24), snapshot()]);
      setFuture([]);
      setNetwork(nextNetwork);
      setOptions(nextOptions);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function undo() {
    const last = history.at(-1);
    if (!last) return;
    setFuture((f) => [...f, snapshot()]);
    setHistory((h) => h.slice(0, -1));
    setNetwork(last.network);
    setOptions(last.options);
  }
  function redo() {
    const next = future.at(-1);
    if (!next) return;
    setHistory((h) => [...h, snapshot()]);
    setFuture((f) => f.slice(0, -1));
    setNetwork(next.network);
    setOptions(next.options);
  }
  function choose(id: string) {
    const c = catalog!.cases.find((c) => c.network.id === id);
    if (!c) return;
    change(clone(c.network), clone(DEFAULT_OPTIONS));
    setBaseline(null);
    setSelected(
      c.network.edges.find((e) => e.kind === "working")?.id ??
        c.network.edges[0].id,
    );
    setLevel(null);
    setCameraReset((v) => v + 1);
  }
  function override(values: Record<string, number | boolean>) {
    if (!selected) return;
    change(network!, {
      ...options,
      overrides: {
        ...options.overrides,
        [selected]: { ...options.overrides[selected], ...values },
      },
    });
  }
  function updateFan(
    key: "pressure" | "coefficient" | "efficiency",
    value: number,
  ) {
    if (!edge?.fan) return;
    const next = clone(network!);
    next.edges[selectedIndex].fan![key] = value;
    change(next);
  }
  function exportProject() {
    if (!network) return;
    download(
      `${network.id}-project.json`,
      serializeProject({
        schema: "aerovia.project/v1",
        network,
        options,
        baseline: baseline ?? undefined,
        savedAt: new Date().toISOString(),
      }),
    );
    setNotice(b("Project exported.", "Proyecto exportado."));
  }
  function exportCSV() {
    if (!effective || !result) return;
    const header = [
      "id",
      "from",
      "to",
      "flow_m3_s",
      "velocity_m_s",
      "resistance_Pa_s2_m6",
      "target_m3_s",
      "shortfall_m3_s",
      "converged",
      "mass_residual_m3_s",
      "pressure_residual_Pa",
    ];
    const rows = effective.edges.map((e, i) => [
      e.id,
      e.from,
      e.to,
      result.flows[i],
      result.velocities[i],
      e.resistance * options.resistanceScale,
      e.target,
      result.shortfalls[i],
      result.converged,
      result.massResidual,
      result.pressureResidual,
    ]);
    download(
      `${network!.id}-results.csv`,
      [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  function importText(text: string) {
    try {
      if (text.length > 2_000_000)
        throw new Error(
          b(
            "File exceeds the 2 MB import limit.",
            "El archivo supera el límite de 2 MB.",
          ),
        );
      const data = JSON.parse(text);
      const importedProject =
        data.schema === "aerovia.project/v1" ? validateProject(data) : null;
      const n = validateNetwork(
        data.schema === "aerovia.project/v1" ? data.network : data,
      );
      const opts =
        data.schema === "aerovia.project/v1"
          ? validateOptions(data.options, n)
          : clone(DEFAULT_OPTIONS);
      change(n, opts);
      setBaseline(importedProject?.baseline ?? null);
      setSelected(
        n.edges.find((e) => e.kind === "working")?.id ?? n.edges[0].id,
      );
      setLevel(null);
      setDialog(null);
      setNotice(
        b(
          "Network validated and loaded locally.",
          "Red validada y cargada localmente.",
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function analyze(kind: "curve" | "sensitivity" | "optimize") {
    if (!network || analysisBusy) return;
    const ticket = analysisRevision.current;
    setAnalysisBusy(true);
    setError("");
    try {
      if (kind === "curve") {
        const data = await request<CurvePoint[]>("curve", network, options);
        if (ticket === analysisRevision.current) setCurveData(data);
      } else if (kind === "sensitivity") {
        const data = await request<SensitivityPoint[]>(
          "sensitivity",
          network,
          options,
        );
        if (ticket === analysisRevision.current) setSensitivityData(data);
      } else {
        const data = await request<OptimizationResult>(
          "optimize",
          network,
          options,
        );
        if (ticket === analysisRevision.current) {
          setOptimum(data);
          if (!data.feasible)
            setNotice(
              data.result.message ??
                b(
                  "Targets are infeasible within the supported speed range.",
                  "Los objetivos son inviables en el rango de velocidad.",
                ),
            );
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalysisBusy(false);
    }
  }
  function setBaselineNow() {
    if (!result?.converged || busy) return;
    setBaseline({
      network: clone(network!),
      options: clone(options),
      result: clone(result),
    });
    setNotice(
      b("Baseline saved for comparison.", "Referencia guardada para comparar."),
    );
  }
  function selectAirway(id: string) {
    setSelected(id);
    setMobileInspector(true);
  }
  if (!catalog || !network || !effective)
    return (
      <main className="startup">
        <Wind size={38} />
        <h1>Aerovia</h1>
        <p>
          {error ||
            b(
              "Loading the verified network library...",
              "Cargando la biblioteca de redes verificadas...",
            )}
        </p>
        {error && (
          <button onClick={() => location.reload()}>
            {b("Retry", "Reintentar")}
          </button>
        )}
      </main>
    );
  const valid =
    result?.converged &&
    !busy &&
    resultInput?.network === network &&
    resultInput?.options === options;
  const targets = effective.edges.filter((e) => e.target > 0).length;
  const shortfalls =
    result?.shortfalls.filter(
      (v, i) => effective.edges[i]?.target > 0 && v > 1e-6,
    ).length ?? 0;
  const safeBaseline = baselineValid ? baseline!.result : null;
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("workspace");
          }}
        >
          <Wind size={27} />
          <span>
            AEROVIA
            <small>{b("UNDERGROUND AIRFLOW", "FLUJO SUBTERRÁNEO")}</small>
          </span>
        </a>
        <nav aria-label={b("Main navigation", "Navegación principal")}>
          {(
            [
              ["workspace", Box, "Workspace", "Espacio"],
              ["analysis", ChartNoAxesCombined, "Analysis", "Análisis"],
              ["network", NetworkIcon, "Network", "Red"],
              ["evidence", BookOpen, "Evidence", "Evidencia"],
            ] as const
          ).map(([key, Icon, en, es]) => (
            <button
              key={key}
              aria-label={b(en, es)}
              title={b(en, es)}
              aria-current={page === key ? "page" : undefined}
              className={page === key ? "active" : ""}
              onClick={() => setPage(key)}
            >
              <Icon size={17} />
              <span>{b(en, es)}</span>
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            aria-label={b("App architecture", "Arquitectura de la aplicación")}
            title={b("App architecture", "Arquitectura de la aplicación")}
            onClick={() => setArchitecture(true)}
          >
            <Info size={18} />
          </button>
          <button
            aria-label={b("Change language", "Cambiar idioma")}
            className="language-toggle"
            onClick={() => setLang(lang === "en" ? "es" : "en")}
          >
            <Globe size={16} />
            <span>{lang.toUpperCase()}</span>
          </button>
          <button
            aria-label={b("Toggle theme", "Cambiar tema")}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a
            className="icon-button"
            href="https://github.com/fsantibanezleal/CAOS_Aerovia"
            target="_blank"
            rel="noreferrer"
            aria-label={b("Public source repository", "Repositorio público")}
          >
            <Code2 size={18} />
          </a>
        </div>
      </header>
      <div className="mobile-bar">
        <button onClick={() => setMobileControls((v) => !v)}>
          <SlidersHorizontal size={16} />
          {b("Controls", "Controles")}
        </button>
        <span>{network.name[lang]}</span>
        <button onClick={() => setMobileInspector((v) => !v)}>
          <Search size={16} />
          {b("Inspect", "Inspeccionar")}
        </button>
      </div>
      <main
        className={`application page-${page} ${focus && page === "workspace" ? "focus-workbench" : ""}`}
      >
        {page !== "evidence" && (
          <aside
            className={`controls-panel ${mobileControls ? "mobile-open" : ""}`}
          >
            <div className="panel-label">
              <span>{b("NETWORK LABORATORY", "LABORATORIO DE REDES")}</span>
              <button
                className="mobile-only"
                onClick={() => setMobileControls(false)}
                aria-label={b("Close controls", "Cerrar controles")}
              >
                <X size={16} />
              </button>
            </div>
            <label className="case-select">
              <span>{b("Engineering case", "Caso de ingeniería")}</span>
              <select
                aria-label={b("Engineering case", "Caso de ingeniería")}
                value={chosenCase ? network.id : "imported"}
                onChange={(e) => choose(e.target.value)}
              >
                {!chosenCase && (
                  <option value="imported">{network.name[lang]}</option>
                )}
                {catalog.cases.map((c) => (
                  <option key={c.network.id} value={c.network.id}>
                    {c.network.name[lang]}
                  </option>
                ))}
              </select>
            </label>
            <p className="case-description">{network.description[lang]}</p>
            <div className="source-badge">
              <span />
              {network.provenance.kind === "authored"
                ? b(
                    "Authored engineering scenario",
                    "Escenario de ingeniería creado",
                  )
                : b("Imported network", "Red importada")}
            </div>
            <div className="control-section">
              <div className="section-label">
                <span>{b("PRIMARY VENTILATION", "VENTILACIÓN PRINCIPAL")}</span>
                <Wind size={17} />
              </div>
              <label className="range-control">
                <span>
                  {b("Fan speed factor", "Factor de velocidad")}
                  <strong>
                    {number(options.speed, 2)}
                    <small>×</small>
                  </strong>
                </span>
                <input
                  aria-label={b("Fan speed factor", "Factor de velocidad")}
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.01"
                  value={options.speed}
                  onChange={(e) =>
                    change(network, { ...options, speed: +e.target.value })
                  }
                />
                <div className="range-labels">
                  <span>0</span>
                  <span>{b("rated 1.0", "nominal 1,0")}</span>
                  <span>1.5</span>
                </div>
              </label>
              <label className="range-control">
                <span>
                  {b("Network resistance", "Resistencia de red")}
                  <strong>
                    {number(options.resistanceScale, 2)}
                    <small>×</small>
                  </strong>
                </span>
                <input
                  aria-label={b("Network resistance", "Resistencia de red")}
                  type="range"
                  min=".25"
                  max="3"
                  step=".05"
                  value={options.resistanceScale}
                  onChange={(e) =>
                    change(network, {
                      ...options,
                      resistanceScale: +e.target.value,
                    })
                  }
                />
                <div className="range-labels">
                  <span>0.25</span>
                  <span>{b("all airways", "todas las galerías")}</span>
                  <span>3.0</span>
                </div>
              </label>
            </div>
            <div className="delivery-summary">
              <div className="section-label">
                <span>{b("TARGET DELIVERY", "ENTREGA OBJETIVO")}</span>
                <span>
                  {targets - shortfalls}/{targets}
                </span>
              </div>
              <div
                className={`target-number ${valid && shortfalls ? "warning" : ""}`}
              >
                {valid
                  ? `${shortfalls && result!.targetRatio >= 0.9995 ? "<100" : number((result?.targetRatio ?? 0) * 100, 1)}%`
                  : "--"}
                <small>{b("weakest branch", "rama limitante")}</small>
              </div>
              <div className="gauge">
                <span
                  style={{
                    width: `${valid ? Math.min(100, Math.max(0, result!.targetRatio * 100)) : 0}%`,
                  }}
                />
              </div>
              <p>
                {b(
                  "Targets are entered planning assumptions.",
                  "Los objetivos son supuestos de planificación.",
                )}
              </p>
            </div>
            <button
              className="primary full"
              disabled={busy || analysisBusy}
              onClick={() => {
                setPage("analysis");
                analyze("optimize");
              }}
            >
              <ChartNoAxesCombined size={17} />
              {b("Find minimum fan speed", "Buscar velocidad mínima")}
              <ArrowUpRight size={16} />
            </button>
            <div className="project-actions">
              <button onClick={setBaselineNow} disabled={!valid}>
                <Save size={16} />
                {b("Save baseline", "Guardar referencia")}
              </button>
              <button onClick={exportProject}>
                <Download size={16} />
                {b("Save project", "Guardar proyecto")}
              </button>
              <button
                onClick={() => {
                  setDraft("");
                  setDialog("import");
                }}
              >
                <Upload size={16} />
                {b("Import network", "Importar red")}
              </button>
            </div>
            <div className="undo-row">
              <button
                onClick={undo}
                disabled={!history.length}
                aria-label={b("Undo change", "Deshacer cambio")}
              >
                <Undo2 size={16} />
              </button>
              <button
                onClick={redo}
                disabled={!future.length}
                aria-label={b("Redo change", "Rehacer cambio")}
              >
                <Redo2 size={16} />
              </button>
              <button
                onClick={() =>
                  chosenCase
                    ? choose(chosenCase.network.id)
                    : change(network, clone(DEFAULT_OPTIONS))
                }
              >
                <RotateCcw size={14} />
                {b("Reset case", "Restablecer")}
              </button>
            </div>
          </aside>
        )}
        {page === "workspace" && (
          <section className="spatial-workbench">
            <div className="workspace-heading">
              <div>
                <span className="eyebrow">
                  {b(
                    "A NETWORK BENEATH THE SURFACE",
                    "UNA RED BAJO LA SUPERFICIE",
                  )}
                </span>
                <h1>{network.name[lang]}</h1>
                <p>
                  {network.nodes.length} {b("junctions", "uniones")}
                  <span>·</span>
                  {network.edges.length} {b("airways", "galerías")}
                  <span>·</span>
                  {levels.length} {b("working levels", "niveles de trabajo")}
                </p>
              </div>
              <div className="view-switch">
                <button
                  onClick={() => setFocus((v) => !v)}
                  aria-label={b("Toggle focus mode", "Cambiar modo enfoque")}
                >
                  <Box size={13} />
                </button>
                <button
                  className={view === "space" ? "active" : ""}
                  onClick={() => setView("space")}
                >
                  3D
                </button>
                <button
                  className={view === "plan" ? "active" : ""}
                  onClick={() => setView("plan")}
                >
                  {b("Plan", "Planta")}
                </button>
              </div>
            </div>
            <div className="scene-container">
              <Suspense
                fallback={
                  <div className="startup">
                    {b(
                      "Preparing the spatial view...",
                      "Preparando la vista espacial...",
                    )}
                  </div>
                }
              >
                <NetworkScene
                  network={effective}
                  result={valid ? result : null}
                  baseline={safeBaseline}
                  metric={metric}
                  selected={selected}
                  onSelect={selectAirway}
                  separation={separation}
                  level={level}
                  view={view}
                  paused={paused}
                  theme={theme}
                  reset={cameraReset}
                  lang={lang}
                  closed={closed}
                  envelope={envelope}
                  cut={cut}
                />
              </Suspense>
              <div className="scene-top-left">
                <span className="scene-badge">
                  {b("SCHEMATIC GEOMETRY", "GEOMETRÍA ESQUEMÁTICA")}
                </span>
              </div>
              <div className="scene-tools">
                <button
                  className={envelope ? "active" : ""}
                  onClick={() => setEnvelope((v) => !v)}
                  aria-label={b(
                    "Toggle context envelope",
                    "Cambiar envolvente contextual",
                  )}
                >
                  <Layers size={17} />
                </button>
                <button
                  onClick={() => setCameraReset((v) => v + 1)}
                  aria-label={b("Reset camera", "Restablecer cámara")}
                >
                  <LocateFixed size={18} />
                </button>
                <button
                  onClick={() => setPaused((v) => !v)}
                  aria-label={
                    paused
                      ? b("Play flow animation", "Reproducir animación")
                      : b("Pause flow animation", "Pausar animación")
                  }
                >
                  {paused ? <Play size={17} /> : <Pause size={17} />}
                </button>
              </div>
              {envelope && (
                <label className="cutaway-control">
                  {b("Section depth", "Profundidad de corte")}
                  <input
                    type="range"
                    aria-label={b("Section depth", "Profundidad de corte")}
                    min="0"
                    max="1"
                    step=".02"
                    value={cut}
                    onChange={(e) => setCut(+e.target.value)}
                  />
                </label>
              )}
              <div className="scene-bottom">
                <label>
                  <Layers size={15} />
                  <select
                    aria-label={b("Visible level", "Nivel visible")}
                    value={level ?? "all"}
                    onChange={(e) =>
                      setLevel(
                        e.target.value === "all" ? null : +e.target.value,
                      )
                    }
                  >
                    <option value="all">
                      {b("All levels", "Todos los niveles")}
                    </option>
                    {levels.map((l) => (
                      <option value={l} key={l}>
                        {b("Level", "Nivel")} {l + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="separate-control">
                  {b("Separate", "Separar")}
                  <input
                    aria-label={b("Level separation", "Separación de niveles")}
                    type="range"
                    min="0"
                    max="1.5"
                    step=".05"
                    value={separation}
                    onChange={(e) => setSeparation(+e.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="visual-encoding">
              <label>
                {b("Color by", "Colorear por")}
                <select
                  aria-label={b("Color by", "Colorear por")}
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as Metric)}
                >
                  {(
                    [
                      ["route", "Airway role", "Tipo de galería"],
                      ["flow", "Airflow", "Caudal"],
                      ["velocity", "Velocity", "Velocidad"],
                      ["pressure", "Pressure", "Presión"],
                      ["target", "Target delivery", "Entrega objetivo"],
                      [
                        "change",
                        "Change from baseline",
                        "Cambio vs referencia",
                      ],
                    ] as const
                  ).map(([id, en, es]) => (
                    <option
                      value={id}
                      key={id}
                      disabled={id === "change" && !baselineValid}
                    >
                      {b(en, es)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="color-legend">
                {metric === "route" ? (
                  <>
                    <span>
                      <i style={{ background: "#48c8bd" }} />
                      {b("Intake", "Admisión")}
                    </span>
                    <span>
                      <i style={{ background: "#96baf5" }} />
                      {b("Workings", "Labores")}
                    </span>
                    <span>
                      <i style={{ background: "#efb76e" }} />
                      {b("Return", "Retorno")}
                    </span>
                  </>
                ) : metric === "target" || metric === "change" ? (
                  <>
                    <span>
                      <i style={{ background: "#48d4b6" }} />
                      {metric === "target"
                        ? b("Meets target", "Cumple objetivo")
                        : b("Increase", "Aumento")}
                    </span>
                    <span>
                      <i style={{ background: "#f47e70" }} />
                      {metric === "target"
                        ? b("Below target", "Bajo objetivo")
                        : b("Decrease", "Reducción")}
                    </span>
                  </>
                ) : (
                  <>
                    <span>{b("Low", "Bajo")}</span>
                    <div className="gradient-key" />
                    <span>{b("High", "Alto")}</span>
                  </>
                )}
              </div>
            </div>
            <div className="metrics-strip">
              <div>
                <span>{b("Fresh-air intake", "Admisión de aire")}</span>
                <strong data-testid="intake">
                  {valid ? number(result?.totalIntake) : "--"}
                  <small>m³/s</small>
                </strong>
              </div>
              <div>
                <span>
                  {b("Fan electricity", "Electricidad de ventilación")}
                </span>
                <strong data-testid="power">
                  {valid ? number(result?.fanPowerKW) : "--"}
                  <small>kW</small>
                </strong>
              </div>
              <div>
                <span>{b("Flow targets met", "Objetivos de caudal")}</span>
                <strong>
                  {valid ? targets - shortfalls : "--"}
                  <small>/ {targets}</small>
                </strong>
              </div>
              {safeBaseline && (
                <div>
                  <span>{b("Power change", "Cambio de potencia")}</span>
                  <strong>
                    {valid
                      ? number(result!.fanPowerKW - safeBaseline.fanPowerKW)
                      : "--"}
                    <small>kW</small>
                  </strong>
                </div>
              )}
            </div>
          </section>
        )}
        {page === "analysis" && (
          <AnalysisView
            lang={lang}
            network={network}
            effective={effective}
            options={options}
            result={result}
            valid={!!valid}
            busy={busy}
            analysisBusy={analysisBusy}
            optimum={optimum}
            curveData={curveData}
            sensitivityData={sensitivityData}
            hours={hours}
            tariff={tariff}
            baseline={safeBaseline}
            ensemble={chosenCase?.ensemble}
            matchesBake={matchesBake}
            selected={selected}
            selectedIndex={selectedIndex}
            onAnalyze={analyze}
            onApplySpeed={(speed) => change(network, { ...options, speed })}
            onHoursChange={setHours}
            onTariffChange={setTariff}
            onInspect={(edgeId) => {
              selectAirway(edgeId);
              setPage("workspace");
            }}
            onSelect={setSelected}
          />
        )}
        {page === "network" && (
          <NetworkView
            lang={lang}
            network={network}
            options={options}
            result={result}
            valid={!!valid}
            busy={busy}
            filtered={filtered}
            selected={selected}
            closed={closed}
            search={search}
            onSearch={setSearch}
            onInspect={selectAirway}
            onEditTopology={() => {
              setDraft(JSON.stringify(network, null, 2));
              setDialog("edit");
            }}
            onExportNetwork={() =>
              download(
                `${network.id}-network.json`,
                JSON.stringify(network, null, 2),
              )
            }
            onExportResults={exportCSV}
          />
        )}
        {page === "evidence" && (
          <Evidence
            lang={lang}
            benchmark={catalog.benchmark}
            caseCount={catalog.cases.length}
          />
        )}
        {(page === "workspace" || page === "network") && (
          <aside
            className={`inspector-panel ${mobileInspector ? "mobile-open" : ""}`}
          >
            <div className="panel-label">
              <span>{b("AIRWAY INSPECTOR", "INSPECTOR DE GALERÍA")}</span>
              <button
                className="mobile-only"
                onClick={() => setMobileInspector(false)}
                aria-label={b("Close inspector", "Cerrar inspector")}
              >
                <X size={16} />
              </button>
            </div>
            <select
              className="airway-select"
              aria-label={b("Selected airway", "Galería seleccionada")}
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {effective.edges.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name[lang]}
                </option>
              ))}
            </select>
            {edge && (
              <>
                <div className="airway-identity">
                  <span className="eyebrow">{edge.id}</span>
                  <h2>{edge.name[lang]}</h2>
                  <p>
                    {edge.from} <ArrowRight size={12} /> {edge.to}
                  </p>
                </div>
                <div className="inspector-flow">
                  <strong>
                    {valid ? number(result!.flows[selectedIndex], 2) : "--"}
                  </strong>
                  <span>m³/s</span>
                  <small>
                    {b("Signed branch flow", "Caudal de rama con signo")}
                  </small>
                </div>
                <div className="small-metrics">
                  <div>
                    <span>{b("Velocity", "Velocidad")}</span>
                    <strong>
                      {valid
                        ? number(result!.velocities[selectedIndex], 2)
                        : "--"}{" "}
                      <small>m/s</small>
                    </strong>
                  </div>
                  <div>
                    <span>{b("Target", "Objetivo")}</span>
                    <strong>
                      {number(edge.target)} <small>m³/s</small>
                    </strong>
                  </div>
                </div>
                <div className="control-section">
                  <div className="section-label">
                    <span>{b("EDIT DESIGN INPUTS", "EDITAR ENTRADAS")}</span>
                    <SlidersHorizontal size={15} />
                  </div>
                  <Numeric
                    label={b("Airway resistance", "Resistencia de galería")}
                    value={edge.resistance}
                    min={0.000001}
                    max={100000}
                    change={(v) => override({ resistance: v })}
                    unit="Pa·s²/m⁶"
                  />
                  <Numeric
                    label={b("Cross-sectional area", "Área transversal")}
                    value={edge.area}
                    min={0.1}
                    max={1000}
                    change={(v) => override({ area: v })}
                    unit="m²"
                  />
                  <Numeric
                    label={b(
                      "Forward airflow target",
                      "Objetivo de caudal hacia adelante",
                    )}
                    value={edge.target}
                    min={0}
                    max={10000}
                    change={(v) => override({ target: v })}
                    unit="m³/s"
                  />
                  <label className="checkbox-control">
                    <input
                      type="checkbox"
                      checked={closed.has(edge.id)}
                      onChange={(e) => override({ closed: e.target.checked })}
                    />
                    {b("Close this airway", "Cerrar esta galería")}
                  </label>
                </div>
                {edge.fan && (
                  <div className="control-section">
                    <div className="section-label">
                      <span>{b("FAN CURVE", "CURVA DE VENTILADOR")}</span>
                    </div>
                    <Numeric
                      label={b("Shut-off pressure", "Presión de cierre")}
                      value={edge.fan.pressure}
                      min={0}
                      max={100000}
                      change={(v) => updateFan("pressure", v)}
                      unit="Pa"
                    />
                    <Numeric
                      label={b("Curve coefficient", "Coeficiente de curva")}
                      value={edge.fan.coefficient}
                      min={0}
                      max={10000}
                      change={(v) => updateFan("coefficient", v)}
                    />
                    <Numeric
                      label={b("Electrical efficiency", "Eficiencia eléctrica")}
                      value={edge.fan.efficiency}
                      min={0.05}
                      max={1}
                      change={(v) => updateFan("efficiency", v)}
                    />
                  </div>
                )}
                {safeBaseline && valid && (
                  <div className="baseline-delta">
                    <span>
                      {b("CHANGE FROM BASELINE", "CAMBIO VS REFERENCIA")}
                    </span>
                    <strong>
                      {number(
                        result!.flows[selectedIndex] -
                          safeBaseline.flows[selectedIndex],
                        2,
                      )}{" "}
                      m³/s
                    </strong>
                  </div>
                )}
                <div className="inspector-note">
                  <BookOpen size={16} />
                  <p>
                    {b(
                      "Resistance and area are independent inputs. Use measured or justified values. A target is a planning assumption.",
                      "Resistencia y área son entradas independientes. Use valores medidos o justificados. El objetivo es un supuesto de planificación.",
                    )}
                  </p>
                </div>
              </>
            )}
          </aside>
        )}
      </main>
      {(error || notice) && (
        <div
          className={`notification ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
        >
          <span>{error || notice}</span>
          <button
            aria-label={b("Dismiss notification", "Cerrar aviso")}
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <footer className="statusbar">
        <span
          className={`solver-status ${result?.converged ? "" : "warn"}`}
          data-testid="solver-status"
        >
          <i />
          {busy ||
          resultInput?.network !== network ||
          resultInput?.options !== options
            ? b("Solving network", "Resolviendo red")
            : result?.converged
              ? b("Network balanced", "Red equilibrada")
              : b("Check model", "Revisar modelo")}
        </span>
        <span className="residuals">
          {b("Mass residual", "Residuo de caudal")}{" "}
          {result?.massResidual?.toExponential(1) ?? "--"} m³/s
        </span>
        <span>
          {b("Local computation · no uploads", "Cálculo local · sin cargas")}
        </span>
        <span className="version">0.01.000</span>
      </footer>
      {architecture && (
        <Architecture lang={lang} close={() => setArchitecture(false)} />
      )}
      {dialog && (
        <Dialog
          title={
            dialog === "edit"
              ? b("Edit network topology", "Editar topología de red")
              : b(
                  "Import a local network or project",
                  "Importar red o proyecto local",
                )
          }
          close={() => {
            setDialog(null);
            setError("");
          }}
        >
          <p>
            {b(
              "Use the versioned JSON network contract. All values use SI units. The existing project is preserved if validation fails. Maximum 2 MB, 120 nodes and 240 airways.",
              "Use el contrato JSON versionado. Todos los valores están en SI. Si falla la validación, se conserva el proyecto actual. Máximo 2 MB, 120 nodos y 240 galerías.",
            )}
          </p>
          <input
            ref={inputFile}
            type="file"
            accept=".json,application/json"
            aria-label={b("Choose JSON file", "Elegir archivo JSON")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 2_000_000) {
                setError(b("File exceeds 2 MB.", "El archivo supera 2 MB."));
                return;
              }
              f.text()
                .then(setDraft)
                .catch(() =>
                  setError(
                    b("Unable to read file.", "No se pudo leer el archivo."),
                  ),
                );
            }}
          />
          <textarea
            aria-label={b("Network JSON", "JSON de red")}
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              onClick={() =>
                download(
                  "network-example.json",
                  JSON.stringify(catalog.cases[0].network, null, 2),
                )
              }
            >
              {b("Download example", "Descargar ejemplo")}
            </button>
            <button
              className="primary"
              onClick={() => importText(draft)}
              disabled={!draft.trim()}
            >
              <Check size={17} />
              {b("Validate and load", "Validar y cargar")}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

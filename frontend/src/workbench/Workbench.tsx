import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CaseSelector, Tabs } from "@fasl-work/caos-app-shell";
import {
  MousePointer2,
  Pencil,
  Link2,
  Move3D,
  Undo2,
  Redo2,
  FilePlus2,
  FolderOpen,
  Download,
  Table2,
  Maximize2,
  Minimize2,
  Focus,
  Play,
  Pause,
  Scissors,
  Trash2,
  Fan,
  PanelLeft,
  RotateCcw,
  CircleHelp,
} from "lucide-react";
import type { Network, NetworkEdge, Options, Result } from "../contracts";
import { DEFAULT_OPTIONS } from "../engine";
import {
  drawAirway,
  moveJunction,
  splitAirway,
  removeAirway,
  editAirway,
  materializeOverrides,
  setBoundary,
  type Position,
} from "../engine/editor";
import { analyzeRoutes } from "../engine/routing";
import type { EditTool, MineSceneProps } from "../scene/MineScene";
import { fieldScale, type Metric } from "../scene/field";
import { regimeDefinitions } from "../content/cases";
import useWorkbench, { type WorkbenchState } from "./useWorkbench";
import useTransport from "./useTransport";
import ProjectDialog from "./ProjectDialog";
import LearnedComparison from "./LearnedComparison";
import Numeric from "../components/Numeric";
import Plot from "../components/Plot";
import { fanOperatingState, fanCurveSamples } from "../components/FanPlot";
import { download } from "../storage";
const MineScene = lazy(() => import("../scene/MineScene"));
type Mode = "design" | "flow" | "transport" | "operations" | "risk" | "models";
type Transport = ReturnType<typeof useTransport>;
const fmt = (n: number | undefined, d = 2) =>
  n === undefined
    ? "--"
    : Number.isFinite(n)
      ? n.toLocaleString(undefined, { maximumFractionDigits: d })
      : "--";

export default function Workbench() {
  const w = useWorkbench(),
    transport = useTransport(w.network, w.options);
  const [dialog, setDialog] = useState<
    "new" | "import" | "tables" | "context" | null
  >(null);
  if (!w.network || !w.effective || !w.catalog)
    return (
      <div className="page-body prose">
        <h1>Aerovia</h1>
        <p role="status">
          {w.error ||
            w.b(
              "Loading the design workspace…",
              "Cargando el espacio de diseño…",
            )}
        </p>
      </div>
    );
  const modes: { id: Mode; en: string; es: string }[] = [
    { id: "design", en: "Design", es: "Diseño" },
    { id: "flow", en: "Airflow & paths", es: "Flujo y rutas" },
    { id: "transport", en: "Tracer transport", es: "Transporte" },
    { id: "operations", en: "Fan operations", es: "Operación" },
    { id: "risk", en: "Uncertainty", es: "Incertidumbre" },
    { id: "models", en: "Learned screening", es: "Modelos aprendidos" },
  ];
  return (
    <div className={`page-body wide av-workbench${w.focus ? " av-focus" : ""}`}>
      <div className="av-project-row">
        <CaseSelector
          layout="select"
          lang={w.lang}
          ariaLabel={w.b("Network case", "Caso de red")}
          selectedId={w.network.id}
          onSelect={w.choose}
          cases={[
            ...w.catalog.cases.map((c) => ({
              id: c.network.id,
              name: c.network.name[w.lang],
              category: w.b(
                "Authored planning networks",
                "Redes de planificación construidas",
              ),
              kind: "synthetic" as const,
            })),
            ...(!w.catalog.cases.some((c) => c.network.id === w.network!.id)
              ? [
                  {
                    id: w.network.id,
                    name: w.network.name[w.lang],
                    kind: "uploaded" as const,
                    category: w.b("Your design", "Su diseño"),
                  },
                ]
              : []),
          ]}
        />
        <div className="av-actions" role="toolbar" aria-label={w.b("Project actions", "Acciones del proyecto")}>
          <button
            onClick={() => setDialog("context")}
            aria-label={w.b(
              "Selected case guide",
              "Guía del caso seleccionado",
            )}
          >
            <CircleHelp size={16} />
          </button>
          <button
            title={w.b("New design", "Nuevo diseño")}
            aria-label={w.b("New design", "Nuevo diseño")}
            onClick={() => setDialog("new")}
          >
            <FilePlus2 size={16} />
            <span>{w.b("New", "Nuevo")}</span>
          </button>
          <button
            onClick={() => setDialog("import")}
            aria-label={w.b("Load", "Cargar")}
          >
            <FolderOpen size={16} />
            <span>{w.b("Load", "Cargar")}</span>
          </button>
          <button onClick={w.exportProject} aria-label={w.b("Save", "Guardar")}>
            <Download size={16} />
            <span>{w.b("Save", "Guardar")}</span>
          </button>
          <button
            onClick={() => setDialog("tables")}
            title={w.b("Network tables", "Tablas de la red")}
            aria-label={w.b("Network tables", "Tablas de la red")}
          >
            <Table2 size={16} />
          </button>
          <button
            onClick={w.undo}
            disabled={!w.history.length}
            aria-label={w.b("Undo edit", "Deshacer edición")}
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={w.redo}
            disabled={!w.future.length}
            aria-label={w.b("Redo edit", "Rehacer edición")}
          >
            <Redo2 size={16} />
          </button>
          <button
            onClick={() => w.setFocus(!w.focus)}
            aria-label={w.b("Toggle focus view", "Alternar vista enfocada")}
          >
            {w.focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      <Tabs
        ariaLabel={w.b("Engineering tools", "Herramientas de ingeniería")}
        tabs={modes.map((m) => ({
          id: m.id,
          label: w.b(m.en, m.es),
          content: <WorkspaceMode w={w} mode={m.id} transport={transport} />,
        }))}
      />
      {(w.error || w.notice) && (
        <div
          className={`av-toast ${w.error ? "av-error" : ""}`}
          role={w.error ? "alert" : "status"}
        >
          {w.error || w.notice}
          <button
            aria-label={w.b("Dismiss", "Cerrar")}
            onClick={() => {
              w.setError("");
              w.setNotice("");
            }}
          >
            ×
          </button>
        </div>
      )}
      {dialog && (
        <ProjectDialog w={w} kind={dialog} close={() => setDialog(null)} />
      )}
    </div>
  );
}

function WorkspaceMode({
  w,
  mode,
  transport: t,
}: {
  w: WorkbenchState;
  mode: Mode;
  transport: Transport;
}) {
  const n = w.network!,
    effective = w.effective!,
    b = w.b;
  const [tool, setTool] = useState<EditTool>("select"),
    [nodeId, setNodeId] = useState<string | null>(null),
    [elevation, setElevation] = useState(Math.min(...n.nodes.map((n) => n.z))),
    [snap, setSnap] = useState(5);
  const [widthScale, setWidthScale] = useState(3),
    [separation, setSeparation] = useState(0),
    [view, setView] = useState<"space" | "plan" | "section">("space"),
    [labels, setLabels] = useState(false),
    [cut, setCut] = useState(false),
    [cutZ, setCutZ] = useState(Math.max(...n.nodes.map((n) => n.z)));
  const [metric, setMetric] = useState<MineSceneProps["metric"]>(
      mode === "transport"
        ? "tracer"
        : mode === "risk"
          ? "target"
          : mode === "design"
            ? "route"
            : "flow",
    ),
    [panel, setPanel] = useState(false);
  const [source, setSource] = useState(
      n.edges.find((e) => e.kind === "working")?.id ?? n.edges[0].id,
    ),
    [release, setRelease] = useState<"pulse" | "continuous">("pulse"),
    [mass, setMass] = useState(10000),
    [duration, setDuration] = useState(300),
    [sourceDuration, setSourceDuration] = useState(30),
    [sourceStart, setSourceStart] = useState(0),
    [intervention, setIntervention] = useState(false),
    [changeTime, setChangeTime] = useState(60),
    [changeSpeed, setChangeSpeed] = useState(0.65),
    [closeBranch, setCloseBranch] = useState("");
  const [routeSource, setRouteSource] = useState(
      n.nodes.find((n) => n.boundary === undefined)?.id ?? n.nodes[0].id,
    ),
    [routeTarget, setRouteTarget] = useState(n.nodes.at(-1)!.id),
    [flowTool, setFlowTool] = useState<"field" | "route" | "pressure">("field");
  const [analysis, setAnalysis] = useState<"duty" | "sensitivity" | "baseline">(
    "duty",
  );
  const [predictedField, setPredictedField] = useState<{
    network: Network;
    options: Options;
    result: Result;
    method: string;
  } | null>(null);
  const prediction =
    predictedField?.network === n && predictedField.options === w.options
      ? predictedField.result
      : null;
  const predictionMethod = prediction ? predictedField!.method : null;
  useEffect(() => {
    setNodeId(null);
    setSource(n.edges.find((e) => e.kind === "working")?.id ?? n.edges[0].id);
    setRouteSource(
      n.nodes.find((n) => n.boundary === undefined)?.id ?? n.nodes[0].id,
    );
    setRouteTarget(n.nodes.at(-1)!.id);
    setElevation(Math.min(...n.nodes.map((n) => n.z)));
  }, [n.id]);
  useEffect(() => () => t.pause(), []);
  useEffect(() => {
    if (mode === "transport") t.clear();
  }, [
    source,
    release,
    mass,
    duration,
    sourceDuration,
    sourceStart,
    intervention,
    changeTime,
    changeSpeed,
    closeBranch,
  ]);
  const node = n.nodes.find((n) => n.id === nodeId),
    edge = w.edge;
  function transaction(
    edit: (network: Network) => Network,
    after?: (before: Network, after: Network, options: Options) => void,
  ) {
    try {
      const clean = materializeOverrides(n, w.options),
        next = edit(clean.network);
      after?.(clean.network, next, clean.options);
      const ids = new Set(next.edges.map((e) => e.id));
      clean.options.overrides = Object.fromEntries(
        Object.entries(clean.options.overrides).filter(([id]) => ids.has(id)),
      );
      w.change(next, clean.options);
    } catch (error) {
      w.setError((error as Error).message);
    }
  }
  function connect(id: string) {
    if ((tool === "draw" || tool === "connect") && nodeId && nodeId !== id)
      transaction((network) => {
        const result = drawAirway(network, nodeId, id);
        w.setSelected(result.edgeId);
        return result.network;
      });
    setNodeId(id);
    const selected = n.nodes.find((n) => n.id === id);
    if (selected) setElevation(selected.z);
  }
  function draw(position: Position) {
    if (!nodeId) return;
    transaction((network) => {
      const result = drawAirway(network, nodeId, position);
      setNodeId(result.nodeId);
      w.setSelected(result.edgeId);
      return result.network;
    });
  }
  function move(id: string, position: Position) {
    transaction((network) => moveJunction(network, id, position));
  }
  const routing = useMemo(() => {
    if (mode !== "flow" || flowTool !== "route") return null;
    try {
      return analyzeRoutes(n, w.options, {
        sourceNodeId: routeSource,
        targetNodeId: routeTarget,
      });
    } catch {
      return null;
    }
  }, [n, w.options, routeSource, routeTarget, mode, flowTool]);
  const transportFrame = t.result?.frames[t.frame];
  const concentrationMax = useMemo(
    () =>
      t.result
        ? t.result.frames.reduce(
            (max, f) =>
              f.cellConcentrations.reduce(
                (m, c) => c.reduce((a, v) => Math.max(a, v), m),
                max,
              ),
            1e-9,
          )
        : 1,
    [t.result],
  );
  const displayResult =
    mode === "transport" && transportFrame
      ? t.result!.flowStates[transportFrame.flowStateIndex].result
      : mode === "models" && prediction
        ? prediction
        : w.valid
          ? w.result
          : null;
  const displayedClosed =
    mode === "transport" && transportFrame
      ? new Set(
          Object.entries(
            t.result!.flowStates[transportFrame.flowStateIndex].options
              .overrides,
          )
            .filter(([, value]) => value.closed)
            .map(([id]) => id),
        )
      : w.closed;
  const effectiveMetric =
    mode === "transport"
      ? "tracer"
      : flowTool === "route" && mode === "flow"
        ? "path"
        : flowTool === "pressure" && mode === "flow"
          ? "pressure"
          : metric;
  const selectedIndex = w.selectedIndex;
  const scale = fieldScale(
    effective,
    displayResult,
    effectiveMetric === "tracer" || effectiveMetric === "path"
      ? "flow"
      : effectiveMetric,
    w.safeBaseline,
  );
  function runTransport() {
    t.run({
      durationSeconds: duration,
      frameCount: 151,
      cellsPerEdge: 8,
      releases: [
        release === "pulse"
          ? {
              kind: "pulse",
              edgeId: source,
              startSeconds: sourceStart,
              massMg: mass,
            }
          : {
              kind: "continuous",
              edgeId: source,
              startSeconds: sourceStart,
              durationSeconds: sourceDuration,
              rateMgPerSecond: mass / sourceDuration,
            },
      ],
      schedule: intervention
        ? [
            {
              timeSeconds: changeTime,
              options: {
                ...w.options,
                speed: changeSpeed,
                overrides: {
                  ...w.options.overrides,
                  ...(closeBranch
                    ? {
                        [closeBranch]: {
                          ...w.options.overrides[closeBranch],
                          closed: true,
                        },
                      }
                    : {}),
                },
              },
            },
          ]
        : [],
    });
  }
  const editInstructions =
    tool === "draw"
      ? b(
          "Pick a junction, then click the grid to extend the mine. Click another junction to connect.",
          "Elija una unión y haga clic en la cuadrícula para extender la mina. Haga clic en otra unión para conectar.",
        )
      : tool === "connect"
        ? b(
            "Pick the start and end junctions. Crossings remain separate until you split and connect them.",
            "Elija las uniones de inicio y fin. Los cruces permanecen separados hasta dividirlos y conectarlos.",
          )
        : tool === "move"
          ? b(
              "Pick a junction and drag an axis. The move commits when you release.",
              "Elija una unión y arrastre un eje. El movimiento se guarda al soltar.",
            )
          : b(
              "Select a tunnel to inspect and edit its geometry, equipment and hydraulic inputs.",
              "Seleccione una galería para inspeccionar y editar su geometría, equipos y entradas hidráulicas.",
            );
  return (
    <div className={`av-mode av-mode-${mode}${panel ? " av-panel-open" : ""}`}>
      <aside
        className="av-controls"
        aria-label={b("Tool parameters", "Parámetros de la herramienta")}
      >
        <div className="av-control-title">
          <h2>
            {mode === "design"
              ? b("Build the mine", "Construir la mina")
              : mode === "flow"
                ? b("Trace the airflow", "Seguir el flujo")
                : mode === "transport"
                  ? b("Release & response", "Emisión y respuesta")
                  : mode === "operations"
                    ? b("Operating strategy", "Estrategia operativa")
                    : mode === "models"
                      ? b(
                          "Compare learned models",
                          "Comparar modelos aprendidos",
                        )
                      : b("Test the margin", "Evaluar el margen")}
          </h2>
          <button
            className="av-panel-close icon-btn"
            onClick={() => setPanel(false)}
          >
            ×
          </button>
        </div>
        {mode === "design" ? (
          <>
            <div
              className="av-edit-tools"
              role="group"
              aria-label={b("Design tools", "Herramientas de diseño")}
            >
              {(
                [
                  {
                    id: "select",
                    en: "Select",
                    es: "Elegir",
                    icon: MousePointer2,
                  },
                  { id: "draw", en: "Draw", es: "Dibujar", icon: Pencil },
                  { id: "connect", en: "Connect", es: "Conectar", icon: Link2 },
                  { id: "move", en: "Move", es: "Mover", icon: Move3D },
                ] as const
              ).map(({ id, en, es, icon: Icon }) => (
                <button
                  key={id}
                  aria-pressed={tool === id}
                  onClick={() => {
                    setTool(id);
                    if (id !== "select") setLabels(true);
                  }}
                >
                  <Icon size={16} />
                  {b(en, es)}
                </button>
              ))}
            </div>
            <p className="av-hint">{editInstructions}</p>
            <label>
              {b("Junction", "Unión")}
              <select
                aria-label={b("Junction", "Unión")}
                value={nodeId ?? ""}
                onChange={(e) => connect(e.target.value)}
              >
                <option value="">
                  {b("Select in the scene", "Seleccione en la escena")}
                </option>
                {n.nodes.map((n) => (
                  <option key={n.id}>{n.id}</option>
                ))}
              </select>
            </label>
            {node ? (
              <section className="av-field-group">
                <div className="av-coordinate-grid">
                  {(["x", "y", "z"] as const).map((k) => (
                    <Numeric
                      key={k}
                      label={`${k.toUpperCase()} · m`}
                      value={node[k]}
                      min={-1e6}
                      max={1e6}
                      step={snap || 0.1}
                      change={(v) => move(node.id, { ...node, [k]: v })}
                    />
                  ))}
                </div>
                <label className="av-check">
                  <input
                    type="checkbox"
                    checked={node.boundary !== undefined}
                    onChange={(e) =>
                      transaction((network) =>
                        setBoundary(
                          network,
                          node.id,
                          e.target.checked ? 0 : null,
                        ),
                      )
                    }
                  />
                  {b(
                    "Surface pressure boundary",
                    "Frontera de presión superficial",
                  )}
                </label>
                {node.boundary !== undefined && (
                  <Numeric
                    label={b("Boundary pressure", "Presión de frontera")}
                    value={node.boundary}
                    min={-1e6}
                    max={1e6}
                    change={(v) =>
                      transaction((network) => setBoundary(network, node.id, v))
                    }
                    unit="Pa"
                  />
                )}
              </section>
            ) : null}
            {tool === "draw" && (
              <div className="av-coordinate-grid">
                <Numeric
                  label={b("Draw elevation", "Elevación de dibujo")}
                  value={elevation}
                  min={-1e6}
                  max={1e6}
                  step={1}
                  change={setElevation}
                  unit="m"
                />
                <Numeric
                  label={b("Grid snap", "Ajuste a cuadrícula")}
                  value={snap}
                  min={0}
                  max={1000}
                  step={1}
                  change={setSnap}
                  unit="m"
                />
              </div>
            )}
            {edge && (
              <section className="av-field-group">
                <h3>{edge.name[w.lang]}</h3>
                <label>
                  {b("Airway type", "Tipo de galería")}
                  <select
                    aria-label={b("Airway type", "Tipo de galería")}
                    value={edge.kind}
                    onChange={(e) =>
                      transaction((network) =>
                        editAirway(network, edge.id, {
                          kind: e.target.value as NetworkEdge["kind"],
                        }),
                      )
                    }
                  >
                    {["working", "intake", "return", "crosscut", "fan"].map(
                      (k) => (
                        <option value={k} key={k}>
                          {
                            (
                              {
                                working: b("Working", "Trabajo"),
                                intake: b("Intake", "Entrada"),
                                return: b("Return", "Retorno"),
                                crosscut: b("Crosscut", "Conexión"),
                                fan: b("Fan", "Ventilador"),
                              } as Record<string, string>
                            )[k]
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <div className="av-coordinate-grid">
                  <Numeric
                    label={b("Area", "Área")}
                    value={edge.area}
                    min={0.1}
                    max={1000}
                    unit="m²"
                    change={(v) => w.override({ area: v })}
                  />
                  <Numeric
                    label={b("Resistance", "Resistencia")}
                    value={edge.resistance}
                    min={1e-6}
                    max={1e6}
                    step={0.01}
                    unit="Pa·s²/m⁶"
                    change={(v) => w.override({ resistance: v })}
                  />
                  <Numeric
                    label={b("Flow target", "Caudal objetivo")}
                    value={edge.target}
                    min={0}
                    max={1e5}
                    unit="m³/s"
                    change={(v) => w.override({ target: v })}
                  />
                  <Numeric
                    label={b("Level", "Nivel")}
                    value={edge.level}
                    min={-100}
                    max={100}
                    step={1}
                    change={(v) =>
                      transaction((network) =>
                        editAirway(network, edge.id, { level: v }),
                      )
                    }
                  />
                </div>
                <div className="av-actions">
                  <button
                    onClick={() =>
                      transaction(
                        (network) => {
                          const result = splitAirway(network, edge.id);
                          setNodeId(result.nodeId);
                          return result.network;
                        },
                        (before, after, options) => {
                          if (options.overrides[edge.id]?.closed) {
                            const ids = new Set(before.edges.map((e) => e.id));
                            for (const e of after.edges)
                              if (!ids.has(e.id))
                                options.overrides[e.id] = { closed: true };
                          }
                        },
                      )
                    }
                  >
                    <Scissors size={15} />
                    {b("Split", "Dividir")}
                  </button>
                  <button
                    onClick={() =>
                      transaction((network) =>
                        editAirway(network, edge.id, { kind: "fan" }),
                      )
                    }
                  >
                    <Fan size={15} />
                    {b("Fan", "Ventilador")}
                  </button>
                  <button
                    aria-label={b(
                      "Delete selected airway",
                      "Eliminar galería seleccionada",
                    )}
                    onClick={() =>
                      transaction((network) => removeAirway(network, edge.id))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </section>
            )}
          </>
        ) : mode === "transport" ? (
          <>
            <label>
              {b("Release airway", "Galería de emisión")}
              <select
                aria-label={b("Release airway", "Galería de emisión")}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {n.edges.map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.name[w.lang]}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                if (w.selected) setSource(w.selected);
              }}
            >
              {b("Use selected tunnel", "Usar galería seleccionada")}
            </button>
            <div className="av-coordinate-grid">
              <label>
                {b("Release type", "Tipo de emisión")}
                <select
                  aria-label={b("Release type", "Tipo de emisión")}
                  value={release}
                  onChange={(e) =>
                    setRelease(e.target.value as "pulse" | "continuous")
                  }
                >
                  <option value="pulse">{b("Pulse", "Pulso")}</option>
                  <option value="continuous">
                    {b("Continuous", "Continua")}
                  </option>
                </select>
              </label>
              <Numeric
                label={b("Total tracer", "Trazador total")}
                value={mass}
                min={0.001}
                max={1e12}
                unit="mg"
                change={setMass}
              />
              <Numeric
                label={b("Start time", "Inicio")}
                value={sourceStart}
                min={0}
                max={duration}
                unit="s"
                change={setSourceStart}
              />
              <Numeric
                label={b("Simulation", "Simulación")}
                value={duration}
                min={1}
                max={86400}
                unit="s"
                change={setDuration}
              />
              {release === "continuous" && (
                <Numeric
                  label={b("Release duration", "Duración de emisión")}
                  value={sourceDuration}
                  min={0.1}
                  max={duration}
                  unit="s"
                  change={setSourceDuration}
                />
              )}
            </div>
            <label className="av-check">
              <input
                type="checkbox"
                checked={intervention}
                onChange={(e) => setIntervention(e.target.checked)}
              />
              {b(
                "Schedule a ventilation change",
                "Programar cambio de ventilación",
              )}
            </label>
            {intervention && (
              <section className="av-field-group">
                <div className="av-coordinate-grid">
                  <Numeric
                    label={b("Change at", "Cambio a")}
                    value={changeTime}
                    min={0.1}
                    max={duration}
                    unit="s"
                    change={setChangeTime}
                  />
                  <Numeric
                    label={b("New fan speed", "Nueva velocidad")}
                    value={changeSpeed}
                    min={0}
                    max={1.5}
                    unit="×"
                    change={setChangeSpeed}
                  />
                </div>
                <label>
                  {b("Close an airway", "Cerrar una galería")}
                  <select
                    aria-label={b("Close an airway", "Cerrar una galería")}
                    value={closeBranch}
                    onChange={(e) => setCloseBranch(e.target.value)}
                  >
                    <option value="">{b("No closure", "Sin cierre")}</option>
                    {n.edges
                      .filter((e) => !e.fan)
                      .map((e) => (
                        <option value={e.id} key={e.id}>
                          {e.name[w.lang]}
                        </option>
                      ))}
                  </select>
                </label>
              </section>
            )}
            <button
              className="av-primary"
              disabled={!w.valid || t.busy}
              onClick={runTransport}
            >
              {t.busy
                ? b("Computing…", "Calculando…")
                : b("Simulate transport", "Simular transporte")}
            </button>
            {t.busy && (
              <button onClick={t.cancel}>
                {b("Cancel simulation", "Cancelar simulación")}
              </button>
            )}
            {t.error && (
              <p className="av-error" role="alert">
                {t.error}
              </p>
            )}
            {t.result && !t.result.completed && (
              <p role="alert">{t.result.message}</p>
            )}
            {transportFrame && (
              <section className="av-ledger">
                <h3>{b("Mass balance", "Balance de masa")}</h3>
                {[
                  [b("Injected", "Inyectado"), transportFrame.injectedMassMg],
                  [b("In mine", "En mina"), transportFrame.storedMassMg],
                  [b("Escaped", "Salió"), transportFrame.escapedMassMg],
                  [b("Removed", "Removido"), transportFrame.removedMassMg],
                  [
                    b("Balance error", "Error de balance"),
                    transportFrame.massBalanceErrorMg,
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <strong>{fmt(Number(value), 4)} mg</strong>
                  </div>
                ))}
                <button
                  onClick={() =>
                    download(
                      "tracer-transport.json",
                      JSON.stringify(
                        {
                          schema: "aerovia.transport-replay/v1",
                          version: __APP_VERSION__,
                          network: n,
                          options: w.options,
                          request: t.request,
                          result: t.result,
                        },
                        null,
                        2,
                      ),
                    )
                  }
                >
                  {b("Export time series", "Exportar serie temporal")}
                </button>
              </section>
            )}
            <p className="av-hint">
              {b(
                "Passive tracer in mixed airway cells. Geometry supplies volume and travel distance; no fire, heat or emergency-response model.",
                "Trazador pasivo en celdas de galería mezcladas. La geometría determina volumen y distancia; no modela incendios, calor ni respuesta de emergencia.",
              )}
            </p>
          </>
        ) : mode === "models" ? (
          <>
            <OperatingInputs w={w} />
            {w.valid && w.result && (
              <LearnedComparison
                network={n}
                options={w.options}
                reference={w.result}
                selected={predictionMethod}
                onSelect={(result, method) => {
                  setPredictedField(
                    result && method
                      ? { network: n, options: w.options, result, method }
                      : null,
                  );
                }}
                onAirwaySelect={w.setSelected}
                lang={w.lang}
              />
            )}
          </>
        ) : (
          <>
            {mode === "flow" && (
              <label>
                {b("Analysis", "Análisis")}
                <select
                  aria-label={b("Analysis", "Análisis")}
                  value={flowTool}
                  onChange={(e) =>
                    setFlowTool(e.target.value as typeof flowTool)
                  }
                >
                  <option value="field">
                    {b("Flow & demand field", "Campo de flujo y demanda")}
                  </option>
                  <option value="route">
                    {b(
                      "Directed transport paths",
                      "Rutas de transporte dirigidas",
                    )}
                  </option>
                  <option value="pressure">
                    {b("Pressure distribution", "Distribución de presión")}
                  </option>
                </select>
              </label>
            )}
            {mode === "flow" && flowTool === "route" ? (
              <>
                <label>
                  {b("Source junction", "Unión de origen")}
                  <select
                    aria-label={b("Source junction", "Unión de origen")}
                    value={routeSource}
                    onChange={(e) => setRouteSource(e.target.value)}
                  >
                    {n.nodes.map((n) => (
                      <option key={n.id}>{n.id}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {b("Destination junction", "Unión de destino")}
                  <select
                    aria-label={b("Destination junction", "Unión de destino")}
                    value={routeTarget}
                    onChange={(e) => setRouteTarget(e.target.value)}
                  >
                    {n.nodes.map((n) => (
                      <option key={n.id}>{n.id}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => {
                    if (nodeId) setRouteSource(nodeId);
                    setLabels(true);
                  }}
                >
                  {b(
                    "Use selected junction as source",
                    "Usar unión seleccionada como origen",
                  )}
                </button>
                <div className="av-ledger">
                  <div>
                    <span>{b("Reachable nodes", "Uniones alcanzables")}</span>
                    <strong>
                      {routing?.nodes.filter((n) => n.reachable).length ?? 0}/
                      {n.nodes.length}
                    </strong>
                  </div>
                  <div>
                    <span>
                      {b("Recirculating groups", "Grupos recirculantes")}
                    </span>
                    <strong>{routing?.recirculation.length ?? 0}</strong>
                  </div>
                  {routing?.path ? (
                    <>
                      <div>
                        <span>{b("Nominal transit", "Tránsito nominal")}</span>
                        <strong>
                          {fmt(routing.path.nominalTransitSeconds)} s
                        </strong>
                      </div>
                      <div>
                        <span>{b("Path length", "Longitud de ruta")}</span>
                        <strong>{fmt(routing.path.length)} m</strong>
                      </div>
                    </>
                  ) : (
                    <p>
                      {b(
                        "No directed airflow path reaches this destination.",
                        "Ninguna ruta de flujo dirigida llega a este destino.",
                      )}
                    </p>
                  )}
                </div>
                <p className="av-hint">
                  {b(
                    "Travel time is length × area / flow along the directed path. This is neither first tracer arrival nor a human evacuation route.",
                    "El tiempo es longitud × área / caudal a lo largo de la ruta dirigida. No es primera llegada del trazador ni ruta de evacuación.",
                  )}
                </p>
              </>
            ) : null}
            <OperatingInputs w={w} />
            {mode === "operations" && (
              <>
                <label>
                  {b("Operating question", "Pregunta operativa")}
                  <select
                    aria-label={b("Operating question", "Pregunta operativa")}
                    value={analysis}
                    onChange={(e) =>
                      setAnalysis(e.target.value as typeof analysis)
                    }
                  >
                    <option value="duty">
                      {b(
                        "Fan duty & least feasible speed",
                        "Operación y mínima velocidad viable",
                      )}
                    </option>
                    <option value="sensitivity">
                      {b(
                        "Resistance sensitivity",
                        "Sensibilidad a resistencia",
                      )}
                    </option>
                    <option value="baseline">
                      {b("Baseline comparison", "Comparación con referencia")}
                    </option>
                  </select>
                </label>
                {analysis === "duty" ? (
                  <>
                    <button
                      onClick={() => w.analyze("curve")}
                      disabled={w.analysisBusy}
                    >
                      {b(
                        "Sweep the fan speed",
                        "Barrer velocidad del ventilador",
                      )}
                    </button>
                    <button
                      onClick={() => w.analyze("optimize")}
                      disabled={w.analysisBusy}
                    >
                      {b(
                        "Find minimum speed meeting targets",
                        "Buscar mínima velocidad que cumple objetivos",
                      )}
                    </button>
                    {w.optimum && (
                      <div className="av-ledger">
                        <p>
                          {w.optimum.feasible
                            ? b(
                                "Feasible operating point",
                                "Punto operativo viable",
                              )
                            : b(
                                "No operating point selected by this search",
                                "La búsqueda no seleccionó un punto operativo",
                              )}
                        </p>
                        {!w.optimum.feasible && (
                          <p role="status">{w.optimum.result.message}</p>
                        )}
                        <strong>
                          {fmt(w.optimum.speed, 3)} × ·{" "}
                          {fmt(w.optimum.result.fanPowerKW)} kW
                        </strong>
                        {w.optimum.feasible && (
                          <button
                            onClick={() =>
                              w.change(n, {
                                ...w.options,
                                speed: w.optimum!.speed,
                              })
                            }
                          >
                            {b(
                              "Apply operating point",
                              "Aplicar punto operativo",
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : analysis === "sensitivity" ? (
                  <button
                    disabled={w.analysisBusy}
                    onClick={() => w.analyze("sensitivity")}
                  >
                    {b(
                      "Rank resistance interventions",
                      "Ordenar intervenciones de resistencia",
                    )}
                  </button>
                ) : (
                  <>
                    <button disabled={!w.valid} onClick={w.setBaselineNow}>
                      {b(
                        "Capture current baseline",
                        "Capturar referencia actual",
                      )}
                    </button>
                    <p>
                      {w.safeBaseline
                        ? `${b("Baseline power", "Potencia de referencia")}: ${fmt(w.safeBaseline.fanPowerKW)} kW`
                        : b(
                            "Capture a baseline, then change the design or operating inputs.",
                            "Capture una referencia y cambie el diseño o las entradas operativas.",
                          )}
                    </p>
                    <button
                      disabled={!w.safeBaseline}
                      onClick={() => setMetric("change")}
                    >
                      {b(
                        "Show spatial flow differences",
                        "Mostrar diferencias espaciales de caudal",
                      )}
                    </button>
                  </>
                )}
                <EnergySummary w={w} />
              </>
            )}
            {mode === "risk" && (
              <>
                <h3>
                  {b("Resistance uncertainty", "Incertidumbre de resistencia")}
                </h3>
                <p className="av-hint">
                  {b(
                    "The local CUDA ensemble perturbs every resistance with independent lognormal factors. Select a tunnel to inspect its interval and target probability.",
                    "El conjunto CUDA local perturba cada resistencia con factores lognormales independientes. Seleccione una galería para inspeccionar su intervalo y probabilidad de objetivo.",
                  )}
                </p>
                {w.matchesBake && w.chosenCase?.ensemble ? (
                  <div className="av-ledger">
                    <div>
                      <span>{b("Realized draws", "Realizaciones")}</span>
                      <strong>{w.chosenCase.ensemble.samples}</strong>
                    </div>
                    <div>
                      <span>{b("Failed solves", "Cálculos fallidos")}</span>
                      <strong>{w.chosenCase.ensemble.failures}</strong>
                    </div>
                    <div>
                      <span>
                        {b(
                          "R coefficient of variation",
                          "Coeficiente de variación R",
                        )}
                      </span>
                      <strong>{fmt(w.chosenCase.ensemble.cv * 100)}%</strong>
                    </div>
                  </div>
                ) : (
                  <p className="av-hint">
                    {b(
                      "This edited state has no baked ensemble. Reset the canonical case for its recorded uncertainty, or run the local pipeline for the edited design.",
                      "Este estado editado no tiene un conjunto precalculado. Restablezca el caso canónico o ejecute el proceso local para este diseño.",
                    )}
                  </p>
                )}
                <button onClick={() => w.choose(n.id)} disabled={!w.chosenCase}>
                  {b("Reset canonical case", "Restablecer caso canónico")}
                </button>
              </>
            )}
          </>
        )}
      </aside>
      <section
        className="av-instrument"
        aria-label={b(
          "Mine analysis instrument",
          "Instrumento de análisis minero",
        )}
      >
        <div className="av-viewport-bar">
          <button
            className="av-panel-toggle"
            aria-label={b("Show tool parameters", "Mostrar parámetros")}
            onClick={() => setPanel(!panel)}
          >
            <PanelLeft size={16} />
          </button>
          <div>
            <strong>{n.name[w.lang]}</strong>
            <span>
              {n.nodes.length} {b("junctions", "uniones")} · {n.edges.length}{" "}
              {b("airways", "galerías")}
            </span>
          </div>
          <div className="av-scene-actions">
            <select
              aria-label={b("Camera view", "Vista de cámara")}
              value={view}
              onChange={(e) => setView(e.target.value as typeof view)}
            >
              <option value="space">3D</option>
              <option value="plan">{b("Plan", "Planta")}</option>
              <option value="section">{b("Section", "Sección")}</option>
            </select>
            <button
              onClick={() => w.setCameraReset((v) => v + 1)}
              aria-label={b("Fit mine to view", "Ajustar mina a la vista")}
            >
              <Focus size={17} />
            </button>
          </div>
        </div>
        <div className="av-visual-stage">
          <Suspense
            fallback={
              <p>{b("Loading 3D instrument…", "Cargando instrumento 3D…")}</p>
            }
          >
            <MineScene
              network={effective}
              result={displayResult}
              baseline={w.safeBaseline}
              metric={effectiveMetric}
              theme={w.theme}
              lang={w.lang}
              selected={w.selected}
              selectedNode={nodeId}
              tool={mode === "design" ? tool : "select"}
              onEdge={(id) => {
                w.setSelected(id);
                setNodeId(null);
              }}
              onNode={mode === "design" ? connect : (id) => setNodeId(id)}
              onDraw={draw}
              onMove={move}
              editElevation={elevation}
              snap={snap}
              separation={separation}
              widthScale={widthScale}
              level={w.level}
              view={view}
              reset={w.cameraReset}
              closed={displayedClosed}
              path={routing?.path?.edgeIds ?? []}
              frame={mode === "transport" ? transportFrame : undefined}
              concentrationMax={concentrationMax}
              labels={labels}
              cut={cut ? cutZ : null}
            />
          </Suspense>
          <div className="av-viz-readout">
            <span>
              {mode === "models" && predictionMethod
                ? `${predictionMethod} · ${b("approximation", "aproximación")}`
                : w.busy
                  ? b("Solving…", "Calculando…")
                  : w.valid
                    ? b("Flow balance solved", "Balance de flujo resuelto")
                    : b(
                        "No valid flow result",
                        "Sin resultado de flujo válido",
                      )}
            </span>
            <strong>
              {fmt(displayResult?.totalIntake)} <small>m³/s</small>
            </strong>
            <span>
              {fmt(displayResult?.fanPowerKW)} kW ·{" "}
              {displayResult?.shortfalls.filter(
                (v, i) => effective.edges[i].target > 0 && v > 1e-6,
              ).length ?? 0}
              /{w.targets} {b("targets short", "objetivos insuficientes")}
            </span>
          </div>
          <div className="av-legend">
            <span>
              {effectiveMetric === "tracer"
                ? b("Concentration · mg/m³", "Concentración · mg/m³")
                : effectiveMetric === "path"
                  ? b("Directed route · amber", "Ruta dirigida · ámbar")
                  : effectiveMetric === "pressure"
                    ? b(
                        "Mean endpoint pressure · Pa",
                        "Presión media de extremos · Pa",
                      )
                    : effectiveMetric === "target"
                      ? b(
                          "Flow target: green met / red short",
                          "Objetivo: verde cumple / rojo insuficiente",
                        )
                      : effectiveMetric === "change"
                        ? b(
                            "Flow difference from baseline · m³/s",
                            "Diferencia de caudal con referencia · m³/s",
                          )
                        : effectiveMetric === "route"
                          ? b(
                              "Intake · return · working · crosscut · fan",
                              "Entrada · retorno · labor · conexión · ventilador",
                            )
                          : effectiveMetric === "velocity"
                            ? b(
                                "Signed velocity · m/s",
                                "Velocidad con signo · m/s",
                              )
                            : b(
                                "Signed flow · m³/s",
                                "Caudal con signo · m³/s",
                              )}
            </span>
            {effectiveMetric === "tracer" && (
              <>
                <i />
                <span>0 -- {fmt(concentrationMax, 3)}</span>
              </>
            )}
            {!["tracer", "path", "route", "target"].includes(
              effectiveMetric,
            ) && (
              <>
                <i
                  style={{
                    background:
                      "linear-gradient(90deg,#b69afa,#526b83,#58d8ca)",
                  }}
                />
                <span>
                  {fmt(-scale.span)} -- 0 -- {fmt(scale.span)} {scale.unit}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="av-display-controls">
          {mode !== "transport" && (
            <select
              aria-label={b("Spatial metric", "Métrica espacial")}
              value={metric}
              onChange={(e) => {
                setMetric(e.target.value as Metric);
                setFlowTool("field");
              }}
            >
              {[
                ["flow", b("Flow", "Caudal")],
                ["velocity", b("Velocity", "Velocidad")],
                ["target", b("Target deficit", "Déficit")],
                ["route", b("Airway types", "Tipos de galería")],
                ["pressure", b("Pressure", "Presión")],
                ["change", b("Baseline delta", "Cambio con referencia")],
              ].map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <label>
            {b("Tunnel width", "Ancho visual")}{" "}
            <input
              type="range"
              min="1"
              max="5"
              step=".25"
              value={widthScale}
              onChange={(e) => setWidthScale(+e.target.value)}
            />
            <output>{widthScale}×</output>
          </label>
          <label>
            {b("Separate levels", "Separar niveles")}
            <input
              type="range"
              min="0"
              max="2"
              step=".1"
              value={separation}
              onChange={(e) => setSeparation(+e.target.value)}
            />
          </label>
          <label>
            {b("Level", "Nivel")}
            <select
              value={w.level ?? "all"}
              onChange={(e) =>
                w.setLevel(e.target.value === "all" ? null : +e.target.value)
              }
            >
              <option value="all">
                {b("All levels", "Todos los niveles")}
              </option>
              {w.levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="av-check">
            <input
              type="checkbox"
              checked={labels}
              onChange={(e) => setLabels(e.target.checked)}
            />
            {b("Labels", "Etiquetas")}
          </label>
          <label className="av-check">
            <input
              type="checkbox"
              checked={cut}
              onChange={(e) => setCut(e.target.checked)}
            />
            {b("Cut", "Corte")}
          </label>
          {cut && (
            <input
              aria-label={b("Cut elevation", "Elevación de corte")}
              type="range"
              min={Math.min(...n.nodes.map((n) => n.z)) - 1}
              max={Math.max(...n.nodes.map((n) => n.z)) + 1}
              value={cutZ}
              onChange={(e) => setCutZ(+e.target.value)}
            />
          )}
        </div>
        {mode === "transport" ? (
          <div className="av-analysis-dock av-transport-dock">
            <div className="av-timeline">
              <button
                onClick={t.play}
                disabled={!t.result?.frames.length}
                aria-label={b(
                  t.playing ? "Pause transport" : "Play transport",
                  t.playing ? "Pausar transporte" : "Reproducir transporte",
                )}
              >
                {t.playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <input
                aria-label={b("Simulation time", "Tiempo de simulación")}
                type="range"
                min="0"
                max={Math.max(1, (t.result?.frames.length ?? 2) - 1)}
                value={t.frame}
                onChange={(e) => t.scrub(+e.target.value)}
                disabled={!t.result}
              />
              <output>{fmt(transportFrame?.timeSeconds, 1)} s</output>
              <select
                aria-label={b("Playback speed", "Velocidad de reproducción")}
                value={t.rate}
                onChange={(e) => t.setRate(+e.target.value)}
              >
                {[1, 5, 10, 30, 60].map((r) => (
                  <option key={r} value={r}>
                    {r}×
                  </option>
                ))}
              </select>
            </div>
            {t.result && selectedIndex >= 0 ? (
              <Plot
                title={`${b("Monitor", "Monitor")}: ${edge?.name[w.lang]}`}
                xlabel="s"
                ylabel="mg/m³"
                onSelect={(time) => {
                  const index = t.result!.frames.reduce(
                    (best, f, i) =>
                      Math.abs(f.timeSeconds - time) <
                      Math.abs(t.result!.frames[best].timeSeconds - time)
                        ? i
                        : best,
                    0,
                  );
                  t.scrub(index);
                }}
                series={[
                  {
                    label: b("Airway mean", "Media de galería"),
                    color: "#e5a94f",
                    values: t.result.frames.map((f) => ({
                      x: f.timeSeconds,
                      y: f.concentrations[selectedIndex],
                    })),
                  },
                ]}
                markers={
                  transportFrame
                    ? [
                        {
                          x: transportFrame.timeSeconds,
                          y: transportFrame.concentrations[selectedIndex],
                          label: b("Now", "Ahora"),
                          color: "#df816c",
                        },
                      ]
                    : []
                }
              />
            ) : (
              <div className="av-empty-instrument">
                <strong>
                  {b(
                    "Follow arrival, dilution and clearance",
                    "Siga la llegada, dilución y limpieza",
                  )}
                </strong>
                <span>
                  {b(
                    "Select a release airway and run the transport model. Then pick any tunnel to compare its time history with the concentration field.",
                    "Seleccione una galería de emisión y ejecute el modelo. Luego elija cualquier galería para comparar su historia temporal con el campo de concentración.",
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`av-analysis-dock${mode === "operations" || mode === "risk" ? " av-chart-dock" : ""}`}
          >
            <EngineeringReadout
              w={w}
              mode={mode}
              analysis={analysis}
              route={routing?.path?.edgeIds ?? []}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function EnergySummary({ w }: { w: WorkbenchState }) {
  const b = w.b;
  return (
    <section
      className="av-ledger"
      aria-label={b("Energy and cost", "Energía y costo")}
    >
      <h3>{b("Energy and cost", "Energía y costo")}</h3>
      <Numeric
        label={b("Operating hours", "Horas operativas")}
        value={w.hours}
        min={0}
        max={8784}
        step={1}
        change={w.setHours}
        unit="h/y"
      />
      <Numeric
        label={b("Electricity tariff", "Tarifa eléctrica")}
        value={w.tariff}
        min={0}
        max={1e6}
        change={w.setTariff}
        unit={b("currency/kWh", "moneda/kWh")}
      />
      <div>
        <span>{b("Annual energy", "Energía anual")}</span>
        <strong>
          {fmt(w.valid ? (w.result!.fanPowerKW * w.hours) / 1000 : undefined)}{" "}
          MWh
        </strong>
      </div>
      <div>
        <span>{b("Annual cost", "Costo anual")}</span>
        <strong>
          {fmt(
            w.valid ? w.result!.fanPowerKW * w.hours * w.tariff : undefined,
            0,
          )}
        </strong>
      </div>
      {w.safeBaseline && (
        <div>
          <span>
            {b(
              "Cost change from baseline",
              "Cambio de costo respecto a referencia",
            )}
          </span>
          <strong>
            {fmt(
              w.valid
                ? (w.result!.fanPowerKW - w.safeBaseline.fanPowerKW) *
                    w.hours *
                    w.tariff
                : undefined,
              0,
            )}
          </strong>
        </div>
      )}
      <p className="av-hint">
        {b(
          "Constant operating point and your entered currency. Energy excludes other mine loads; tariff excludes fixed charges.",
          "Punto operativo constante y moneda ingresada. La energía excluye otras cargas de la mina; la tarifa excluye cargos fijos.",
        )}
      </p>
    </section>
  );
}

function OperatingInputs({ w }: { w: WorkbenchState }) {
  const b = w.b,
    edge = w.edge;
  return (
    <section className="av-field-group">
      <label>
        {b("Operating regime", "Régimen operativo")}
        <select
          aria-label={b("Operating regime", "Régimen operativo")}
          value="custom"
          onChange={(e) => {
            const regime = e.target.value,
              canonical = w.chosenCase?.network ?? w.network!;
            const options: Options = structuredClone(DEFAULT_OPTIONS);
            if (regime === "turndown") options.speed = 0.65;
            if (regime === "boost") options.speed = 1.25;
            if (regime === "roughness") options.resistanceScale = 1.5;
            if (
              regime === "working-restriction" ||
              regime === "return-restriction"
            )
              for (const edge of canonical.edges)
                if (
                  edge.kind ===
                  (regime === "working-restriction" ? "working" : "return")
                )
                  options.overrides[edge.id] = {
                    resistance: edge.resistance * 3,
                  };
            w.change(structuredClone(canonical), options);
          }}
        >
          <option value="custom" disabled>
            {b("Choose a comparison state", "Elegir estado de comparación")}
          </option>
          {regimeDefinitions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name[w.lang === "en" ? 0 : 1]}
            </option>
          ))}
        </select>
      </label>
      <label className="av-range-label">
        {b("Fan speed", "Velocidad del ventilador")}
        <output>{fmt(w.options.speed * 100, 0)}%</output>
        <input
          aria-label={b("Fan speed", "Velocidad del ventilador")}
          type="range"
          min="0"
          max="1.5"
          step=".01"
          value={w.options.speed}
          onChange={(e) =>
            w.change(w.network!, { ...w.options, speed: +e.target.value })
          }
        />
      </label>
      <Numeric
        label={b("Global resistance factor", "Factor global de resistencia")}
        value={w.options.resistanceScale}
        min={0.2}
        max={5}
        step={0.05}
        change={(v) =>
          w.change(w.network!, { ...w.options, resistanceScale: v })
        }
        unit="×"
      />
      {edge && (
        <>
          <h3>{edge.name[w.lang]}</h3>
          <label className="av-check">
            <input
              type="checkbox"
              checked={w.closed.has(edge.id)}
              onChange={(e) => w.override({ closed: e.target.checked })}
            />
            {b("Close this airway", "Cerrar esta galería")}
          </label>
          <Numeric
            label={b("Airway resistance", "Resistencia de galería")}
            value={edge.resistance}
            min={1e-6}
            max={1e6}
            change={(v) => w.override({ resistance: v })}
            unit="Pa·s²/m⁶"
          />
          {edge.fan && (
            <>
              <Numeric
                label={b(
                  "Fan shutoff pressure",
                  "Presión de cierre del ventilador",
                )}
                value={edge.fan.pressure}
                min={0}
                max={1e5}
                change={(v) => w.updateFan("pressure", v)}
                unit="Pa"
              />
              <Numeric
                label={b("Fan curve coefficient", "Coeficiente de curva")}
                value={edge.fan.coefficient}
                min={0}
                max={1e4}
                change={(v) => w.updateFan("coefficient", v)}
              />
              <Numeric
                label={b("Efficiency", "Eficiencia")}
                value={edge.fan.efficiency}
                min={0.05}
                max={1}
                change={(v) => w.updateFan("efficiency", v)}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

function EngineeringReadout({
  w,
  mode,
  analysis,
  route,
}: {
  w: WorkbenchState;
  mode: Mode;
  analysis: "duty" | "sensitivity" | "baseline";
  route: string[];
}) {
  const b = w.b,
    edge = w.edge,
    i = w.selectedIndex,
    r = w.valid ? w.result : null;
  if (
    mode === "operations" &&
    analysis === "duty" &&
    !w.curveData.length &&
    r
  ) {
    const state = fanOperatingState(w.network!, w.options, r);
    if (state.kind === "active") {
      const samples = fanCurveSamples(state.edge, w.options.speed, state.flow);
      const series = [
        { label: state.edge.name[w.lang], color: "#dfac68", values: samples },
      ];
      if (state.equivalent)
        series.push({
          label: b("Equivalent network", "Red equivalente"),
          color: "#55bdb9",
          values: samples.map((p) => ({
            x: p.x,
            y: (state.pressure / (state.flow * state.flow)) * p.x * p.x,
          })),
        });
      return (
        <Plot
          title={b(
            "Fan duty at current speed",
            "Punto del ventilador a velocidad actual",
          )}
          xlabel="m³/s"
          ylabel="Pa"
          series={series}
          markers={[
            {
              x: state.flow,
              y: state.pressure,
              label: b("Operating point", "Punto operativo"),
              color: "#ab91d5",
            },
          ]}
        />
      );
    }
  }
  if (mode === "operations" && analysis === "duty" && w.curveData.length)
    return (
      <Plot
        title={b("Fan speed sweep", "Barrido de velocidad")}
        xlabel={b("Speed factor", "Factor de velocidad")}
        ylabel="m³/s"
        series={[
          {
            label: b("Intake", "Entrada"),
            color: "#69b9de",
            values: w.curveData.map((p) => ({ x: p.speed, y: p.flow })),
          },
        ]}
        markers={
          r
            ? [
                {
                  x: w.options.speed,
                  y: r.totalIntake,
                  label: b("Current", "Actual"),
                  color: "#f0b96a",
                },
              ]
            : []
        }
      />
    );
  if (
    mode === "operations" &&
    analysis === "sensitivity" &&
    w.sensitivityData.length
  )
    return (
      <div className="av-sensitivity-bars">
        {[...w.sensitivityData]
          .sort((a, b) => Math.abs(b.elasticity) - Math.abs(a.elasticity))
          .slice(0, 8)
          .map((p) => (
            <button key={p.edgeId} onClick={() => w.setSelected(p.edgeId)}>
              <span>
                {w.network!.edges.find((e) => e.id === p.edgeId)!.name[w.lang]}
              </span>
              <i
                style={{
                  width: `${Math.min(100, Math.abs(p.elasticity) * 100)}%`,
                }}
              />
              <strong>
                {p.elasticity.toFixed(3)} · {p.powerDelta.toFixed(2)} kW
              </strong>
            </button>
          ))}
      </div>
    );
  if (mode === "risk" && w.matchesBake && w.chosenCase?.ensemble && i >= 0) {
    const e = w.chosenCase.ensemble;
    const indices = w
      .network!.edges.map((edge, i) => ({ edge, i }))
      .filter(({ edge }) => edge.target > 0);
    return (
      <div className="av-risk-chart">
        <Plot
          title={b(
            "Working-airway uncertainty · click a branch index",
            "Incertidumbre en labores · elija índice de rama",
          )}
          xlabel={b("Working airway", "Galería de trabajo")}
          ylabel="m³/s"
          series={[
            {
              label: "P05",
              color: "#6b91c8",
              values: indices.map(({ i }, j) => ({
                x: j + 1,
                y: e.flowP05[i],
              })),
            },
            {
              label: "P50",
              color: "#5bc6b0",
              values: indices.map(({ i }, j) => ({
                x: j + 1,
                y: e.flowP50[i],
              })),
            },
            {
              label: "P95",
              color: "#c68ec3",
              values: indices.map(({ i }, j) => ({
                x: j + 1,
                y: e.flowP95[i],
              })),
            },
            {
              label: b("Target", "Objetivo"),
              color: "#d9aa57",
              values: indices.map(({ edge }, j) => ({
                x: j + 1,
                y: edge.target,
              })),
            },
          ]}
          onSelect={(index) => {
            const item =
              indices[
                Math.max(0, Math.min(indices.length - 1, Math.round(index) - 1))
              ];
            if (item) w.setSelected(item.edge.id);
          }}
          markers={
            indices.some((v) => v.i === i)
              ? [
                  {
                    x: indices.findIndex((v) => v.i === i) + 1,
                    y: e.flowP50[i],
                    label: edge?.name[w.lang] ?? "",
                    color: "#edbc6e",
                  },
                ]
              : []
          }
        />
        <div className="av-interval-readout">
          <div>
            <h3>{edge?.name[w.lang]}</h3>
            <span>
              {b(
                "Recorded 5–95% flow interval",
                "Intervalo registrado 5–95% de caudal",
              )}
            </span>
            <strong>
              {fmt(e.flowP05[i])} -- {fmt(e.flowP95[i])} m³/s
            </strong>
          </div>
          <div>
            <span>{b("Median", "Mediana")}</span>
            <strong>{fmt(e.flowP50[i])} m³/s</strong>
            <span>
              {b("Target probability", "Probabilidad de objetivo")}:{" "}
              {edge?.target
                ? fmt(e.targetProbability[i] * 100) + "%"
                : b("no target", "sin objetivo")}
            </span>
          </div>
          <div>
            <span>{b("Fan power 5–95%", "Potencia 5–95%")}</span>
            <strong>
              {fmt(e.powerP05)} -- {fmt(e.powerP95)} kW
            </strong>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="av-selected-readout">
      <div>
        <span>{b("Selected airway", "Galería seleccionada")}</span>
        <h3>
          {edge?.name[w.lang] ?? b("Select a tunnel", "Seleccione una galería")}
        </h3>
        <small>{edge ? `${edge.from} → ${edge.to}` : ""}</small>
      </div>
      <div>
        <span>{b("Signed flow", "Caudal con signo")}</span>
        <strong>
          {fmt(r?.flows[i])} <small>m³/s</small>
        </strong>
      </div>
      <div>
        <span>{b("Velocity", "Velocidad")}</span>
        <strong>
          {fmt(r?.velocities[i])} <small>m/s</small>
        </strong>
      </div>
      <div>
        <span>{b("Target / deficit", "Objetivo / déficit")}</span>
        <strong>
          {fmt(edge?.target)} / {fmt(r?.shortfalls[i])} <small>m³/s</small>
        </strong>
      </div>
      <div>
        <span>
          {b("Mass / pressure residual", "Residuo de masa / presión")}
        </span>
        <strong>
          {r?.massResidual.toExponential(1) ?? "--"} /{" "}
          {r?.pressureResidual.toExponential(1) ?? "--"}
        </strong>
        <small>m³/s · Pa</small>
      </div>
      {route.length > 0 && (
        <span>
          {route.length}{" "}
          {b("airways in selected path", "galerías en ruta seleccionada")}
        </span>
      )}
    </div>
  );
}

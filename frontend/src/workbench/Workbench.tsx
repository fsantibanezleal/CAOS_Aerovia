import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CaseWorkbench,
  ChipGroup,
  Knob,
  Readout,
  SubTabs,
  Verdict,
  formatNumber,
  removeQueryParam,
  replaceQueryParam,
  useLangStore,
  useUrlView,
  useWorkbenchState,
  type CaseDef,
  type RailSection,
} from "@fasl-work/caos-app-shell";
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
  Play,
  Pause,
  Scissors,
  Trash2,
  Fan,
  PanelLeft,
  Focus,
  BookmarkPlus,
  GitCompare,
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
import CaseContext from "../content/CaseContext";
import { ReadinessNote, STATE_LABEL } from "../readiness/ReadinessNote";
import { networkAbsent, VIEW_ROWS } from "../readiness/readiness";
import { useReadiness } from "../readiness/useReadiness";
import useWorkbench, { type WorkbenchState } from "./useWorkbench";
import useTransport from "./useTransport";
import ProjectDialog from "./ProjectDialog";
import LearnedComparison from "./LearnedComparison";
import { GROUPS, groupById, type GroupId } from "./groups";
import { stateControls } from "./railState";
import Numeric from "../components/Numeric";
import Plot from "../components/Plot";
import { fanOperatingState, fanCurveSamples } from "../components/FanPlot";
import { download } from "../storage";
import { fixed } from "../presentation";
const MineScene = lazy(() => import("../scene/MineScene"));
/** The mode of the old App that a group's code still branches on (the airflow group merges flow and operations). */
type Mode = "design" | "flow" | "transport" | "operations" | "risk" | "models";
const MODE_OF: Record<GroupId, Mode> = {
  design: "design",
  airflow: "flow",
  transport: "transport",
  uncertainty: "risk",
  models: "models",
};
const DEFAULT_METRIC: Record<GroupId, Metric | "tracer"> = {
  design: "route",
  airflow: "flow",
  transport: "tracer",
  uncertainty: "target",
  models: "flow",
};
type Transport = ReturnType<typeof useTransport>;
const fmt = (n: number | undefined, d = 2) =>
  n === undefined
    ? "--"
    : Number.isFinite(n)
      ? n.toLocaleString(useLangStore.getState().lang, {
          maximumFractionDigits: d,
        })
      : "--";
const SUB_PARAM = "sub";
const isGroupId = (id: string | undefined): id is GroupId =>
  GROUPS.some((g) => g.id === id);
const readSub = () => {
  try {
    return new URLSearchParams(window.location.search).get(SUB_PARAM);
  } catch {
    return null;
  }
};

/** The words of the loading and failure states of the whole App: the shell's frame is up, the network is not. */
function Pending({ w }: { w: WorkbenchState }) {
  return w.error ? (
    <p className="caos-pending" role="alert" data-state="unavailable">
      {w.error}
    </p>
  ) : (
    <p className="caos-pending" role="status" data-state="loading">
      {w.b("Loading the design workspace…", "Cargando el espacio de diseño…")}
    </p>
  );
}

export default function Workbench() {
  const w = useWorkbench(),
    transport = useTransport(w.network, w.options);
  const [dialog, setDialog] = useState<"new" | "import" | "tables" | null>(
    null,
  );
  const loaded = w.network && w.effective && w.catalog;
  return (
    <>
      {loaded ? (
        <Loaded w={w} transport={transport} setDialog={setDialog} />
      ) : (
        <CaseWorkbench
          caseId=""
          groups={GROUPS.map((g) => ({
            id: g.id,
            label: { en: g.en, es: g.es },
            content: <Pending w={w} />,
          }))}
          rail={<Pending w={w} />}
          context={{ content: <Pending w={w} /> }}
        />
      )}
      {(w.error || w.notice) && loaded && (
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
    </>
  );
}

/** Operating point of the rail (Knob and ChipGroup are registered controls): every value that changes the solve. */
function OperatingRail({ w }: { w: WorkbenchState }) {
  const edge = w.edge;
  return (
    <>
      <Knob
        id="speed"
        label={{ en: "Fan speed", es: "Velocidad del ventilador" }}
        hint={{
          en: "Common speed factor of every fan; 1 is the design speed.",
          es: "Factor de velocidad común de todos los ventiladores; 1 es la velocidad de diseño.",
        }}
        value={w.options.speed}
        min={0}
        max={1.5}
        step={0.01}
        unit="×"
        format={{ decimals: 2 }}
        onChange={(speed) => w.change(w.network!, { ...w.options, speed })}
      />
      <Knob
        id="resistance"
        label={{ en: "Resistance scale", es: "Escala de resistencia" }}
        hint={{
          en: "Global factor on every airway resistance, for roughness or fouling.",
          es: "Factor global sobre la resistencia de cada galería, por rugosidad o ensuciamiento.",
        }}
        value={w.options.resistanceScale}
        min={0.2}
        max={5}
        step={0.05}
        unit="×"
        format={{ decimals: 2 }}
        onChange={(resistanceScale) =>
          w.change(w.network!, { ...w.options, resistanceScale })
        }
      />
      <ChipGroup
        id="airway-state"
        label={{ en: "Selected airway", es: "Galería seleccionada" }}
        options={[
          {
            id: "open",
            label: { en: "Open", es: "Abierta" },
            disabled: !edge,
          },
          {
            id: "closed",
            label: { en: "Closed", es: "Cerrada" },
            disabled: !edge,
          },
        ]}
        value={edge && w.closed.has(edge.id) ? "closed" : "open"}
        onChange={(id) => w.override({ closed: id === "closed" })}
      />
      {edge && (
        <p className="av-rail-note" title={edge.name[w.lang]}>
          {edge.name[w.lang]}
        </p>
      )}
    </>
  );
}

/** Readouts of the rail: the solved network, checked against the selection key. */
function ReadoutsRail({ w }: { w: WorkbenchState }) {
  const stateKey = useWorkbenchState()?.stateKey;
  const r = w.valid ? w.result : null;
  const deficit = r
    ? r.shortfalls.reduce(
        (sum, v, i) =>
          w.effective!.edges[i].target > 0 ? sum + Math.max(0, v) : sum,
        0,
      )
    : null;
  return (
    <>
      <Readout
        title={{ en: "Solved network", es: "Red resuelta" }}
        lane="live"
        provenance="synthetic"
        dataKey={stateKey}
        items={[
          {
            label: { en: "Total airflow", es: "Caudal total" },
            value: r?.totalIntake ?? null,
            unit: "m³/s",
            format: { decimals: 2 },
          },
          {
            label: { en: "Fan power", es: "Potencia de ventiladores" },
            value: r?.fanPowerKW ?? null,
            unit: "kW",
            format: { decimals: 2 },
          },
          {
            label: { en: "Target deficit", es: "Déficit de objetivos" },
            value: deficit,
            unit: "m³/s",
            format: { decimals: 2 },
            better: "lower",
            good: 1e-6,
          },
          {
            label: { en: "Airways short", es: "Galerías insuficientes" },
            value: r ? w.shortfalls : null,
            unit: { en: `of ${w.targets}`, es: `de ${w.targets}` },
            format: { decimals: 0 },
          },
          {
            label: { en: "Mass residual", es: "Residuo de masa" },
            value: r?.massResidual ?? null,
            unit: "m³/s",
          },
        ]}
      />
      <Verdict
        title={{ en: "Convergence", es: "Convergencia" }}
        compact
        tone={w.busy ? "neutral" : r ? "good" : "bad"}
        verdict={
          w.busy
            ? { en: "Solving", es: "Calculando" }
            : r
              ? { en: "Flow balance solved", es: "Balance de flujo resuelto" }
              : { en: "No valid flow result", es: "Sin resultado válido" }
        }
      />
    </>
  );
}

/** Project actions of the rail: the design file, the edit history and the baseline. */
function ProjectRail({
  w,
  setDialog,
  compare,
}: {
  w: WorkbenchState;
  setDialog: (kind: "new" | "import" | "tables") => void;
  compare: () => void;
}) {
  const b = w.b;
  return (
    <div
      className="av-rail-actions"
      role="toolbar"
      aria-label={b("Project actions", "Acciones del proyecto")}
    >
      <button
        type="button"
        className="btn av-rail-btn"
        title={b("New design", "Nuevo diseño")}
        aria-label={b("New design", "Nuevo diseño")}
        onClick={() => setDialog("new")}
      >
        <FilePlus2 size={16} />
        <span>{b("New", "Nuevo")}</span>
      </button>
      <button
        type="button"
        className="btn av-rail-btn"
        aria-label={b("Load", "Cargar")}
        onClick={() => setDialog("import")}
      >
        <FolderOpen size={16} />
        <span>{b("Load", "Cargar")}</span>
      </button>
      <button
        type="button"
        className="btn av-rail-btn"
        aria-label={b("Save", "Guardar")}
        onClick={w.exportProject}
      >
        <Download size={16} />
        <span>{b("Save", "Guardar")}</span>
      </button>
      <button
        type="button"
        className="btn av-rail-btn"
        title={b("Network tables", "Tablas de la red")}
        aria-label={b("Network tables", "Tablas de la red")}
        onClick={() => setDialog("tables")}
      >
        <Table2 size={16} />
        <span>{b("Tables", "Tablas")}</span>
      </button>
      <button
        type="button"
        className="btn av-rail-btn"
        aria-label={b("Undo edit", "Deshacer edición")}
        disabled={!w.history.length}
        onClick={w.undo}
      >
        <Undo2 size={16} />
        <span>{b("Undo", "Deshacer")}</span>
      </button>
      <button
        type="button"
        className="btn av-rail-btn"
        aria-label={b("Redo edit", "Rehacer edición")}
        disabled={!w.future.length}
        onClick={w.redo}
      >
        <Redo2 size={16} />
        <span>{b("Redo", "Rehacer")}</span>
      </button>
      <button
        type="button"
        className="btn av-rail-btn"
        aria-label={b("Save baseline", "Guardar referencia")}
        disabled={!w.valid}
        onClick={w.setBaselineNow}
      >
        <BookmarkPlus size={16} />
        <span>{b("Baseline", "Referencia")}</span>
      </button>
      <button
        type="button"
        className="btn av-rail-btn"
        aria-label={b("Compare to baseline", "Comparar con la referencia")}
        disabled={!w.safeBaseline}
        onClick={compare}
      >
        <GitCompare size={16} />
        <span>{b("Compare", "Comparar")}</span>
      </button>
    </div>
  );
}

/**
 * A DOM node that React content keeps alive elsewhere: the learned comparison holds its model runs in its own state,
 * and a sub-view that is not open is unmounted by the shell's SubTabs. The comparison is rendered once into `node` (a
 * portal) and the sub-view only mounts that node, so its runs survive a change of sub-view and Focus.
 */
function Slot({ node, className }: { node: HTMLElement; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const parent = host.current;
    if (!parent) return;
    parent.appendChild(node);
    return () => {
      if (node.parentNode === parent) parent.removeChild(node);
    };
  }, [node]);
  return <div className={`av-slot${className ? ` ${className}` : ""}`} ref={host} />;
}

function Loaded({
  w,
  transport,
  setDialog,
}: {
  w: WorkbenchState;
  transport: Transport;
  setDialog: (kind: "new" | "import" | "tables") => void;
}) {
  const n = w.network!,
    b = w.b;
  const readiness = useReadiness();
  // The open group is held in ?view=, the open sub-view of the group in ?sub=, Focus in ?focus=1 (the shell's).
  const ids = useMemo(() => [...GROUPS.map((g) => g.id), "context"], []);
  const [open, selectOpen] = useUrlView(ids, "view");
  const [subRaw, setSubRaw] = useState<string | null>(readSub);
  const [lastGroup, setLastGroup] = useState<GroupId>("design");
  // Focus is the shell's (?focus=1); the product only follows it, to lay the group out for the stage.
  const [focusOn, setFocusOn] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("focus") === "1";
    } catch {
      return false;
    }
  });
  const group: GroupId = isGroupId(open) ? open : lastGroup;
  useEffect(() => {
    if (isGroupId(open)) setLastGroup(open);
  }, [open]);
  const def = groupById(group)!;
  const sub = def.subs.some((s) => s.id === subRaw) ? subRaw! : def.subs[0].id;
  const setSub = (id: string) => {
    setSubRaw(id);
    replaceQueryParam(SUB_PARAM, id);
  };
  const selectGroup = (id: string) => {
    selectOpen(id);
    setSubRaw(null);
    removeQueryParam(SUB_PARAM);
  };
  const learnedNode = useMemo(() => document.createElement("div"), []);
  const sceneNode = useMemo(() => {
    const el = document.createElement("div");
    el.className = "av-scene-host";
    return el;
  }, []);
  const s = useInstrument({
    w,
    group,
    sub,
    setSub,
    transport,
    learnedNode,
    sceneNode,
    focusOn,
  });
  const controls = useMemo(
    () => stateControls(w.network!, w.options),
    [w.network, w.options],
  );
  const cases: CaseDef[] = [
    ...w.catalog!.cases.map((c) => ({
      id: c.network.id,
      // a network the readiness document lists as absent from the case library says so in the selector
      name:
        c.network.name[w.lang] +
        (networkAbsent(readiness ?? null, c.network.id)
          ? ` (${STATE_LABEL.missing[w.lang].toLowerCase()})`
          : ""),
      category: b("Authored planning networks", "Redes de planificación construidas"),
      kind: "synthetic" as const,
    })),
    ...(!w.catalog!.cases.some((c) => c.network.id === n.id)
      ? [
          {
            id: n.id,
            name: n.name[w.lang],
            kind: "uploaded" as const,
            category: b("Your design", "Su diseño"),
          },
        ]
      : []),
  ];
  return (
    <>
      <CaseWorkbench
        caseId={n.id}
        cases={{
          cases,
          selectedId: n.id,
          onSelect: w.choose,
          layout: "select",
          deepLink: true,
          lang: w.lang,
          ariaLabel: b("Network case", "Caso de red"),
        }}
        controls={controls}
        rail={
          [
            {
              id: "operating",
              label: { en: "Setpoint", es: "Punto" },
              content: <OperatingRail w={w} />,
            },
            {
              id: "readouts",
              label: { en: "Values", es: "Valores" },
              content: <ReadoutsRail w={w} />,
            },
            {
              id: "project",
              label: { en: "Project", es: "Proyecto" },
              content: (
                <ProjectRail
                  w={w}
                  setDialog={setDialog}
                  compare={s.compareToBaseline}
                />
              ),
            },
          ] satisfies RailSection[]
        }
        railLabel={{ en: "Case and controls", es: "Caso y controles" }}
        group={open}
        onGroupChange={selectGroup}
        focus={{ hud: s.hud, onChange: setFocusOn }}
        groups={GROUPS.map((g) => ({
          id: g.id,
          label: { en: g.en, es: g.es },
          lane: g.id === "uncertainty" && w.matchesBake ? "replay" : "live",
          provenance: "synthetic",
          content: g.id === group ? s.content : null,
        }))}
        context={{
          content: (
            <>
              <ReadinessNote ids={VIEW_ROWS.workbench} />
              <CaseContext network={n} />
            </>
          ),
        }}
        ariaLabel={{ en: "Workbench views", es: "Vistas del banco de trabajo" }}
      />
      {open !== "context" && createPortal(s.scene, sceneNode)}
      {group === "models" && s.learned && createPortal(s.learned, learnedNode)}
    </>
  );
}

function useInstrument({
  w,
  group,
  sub,
  setSub,
  transport: t,
  learnedNode,
  sceneNode,
  focusOn,
}: {
  w: WorkbenchState;
  group: GroupId;
  focusOn: boolean;
  sub: string;
  setSub: (id: string) => void;
  transport: Transport;
  learnedNode: HTMLElement;
  sceneNode: HTMLElement;
}) {
  const mode = MODE_OF[group];
  const setToolPage = setSub;
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
      DEFAULT_METRIC[group],
    ),
    // The tool pane floats over the scene so the scene keeps the instrument (ADR-0071 rule 8): open from the width
    // where it leaves the scene readable, closed on a phone until asked for.
    [panel, setPanel] = useState(() => {
      try {
        return window.matchMedia("(min-width: 900px)").matches;
      } catch {
        return true;
      }
    });
  // A group opens on its own spatial metric, as each mode did.
  const firstGroup = useRef(true);
  useEffect(() => {
    if (firstGroup.current) firstGroup.current = false;
    else {
      setMetric(DEFAULT_METRIC[group]);
      setFlowTool("field");
    }
  }, [group]);
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
  useEffect(() => () => t.pause(), [group]);
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
    setToolPage("monitor");
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

  const conditionsPage = {
    id: "conditions",
    label: b("Operating conditions", "Condiciones operativas"),
    content: (
      <>
        <OperatingInputs w={w} scope="global" />
      </>
    ),
  };
  const equipmentPage = {
    id: "equipment",
    label: b("Selected equipment", "Equipo seleccionado"),
    content: (
      <>
        <OperatingInputs w={w} scope="edge" />
      </>
    ),
  };
  const viewPage = {
    id: "view",
    label: b("Display and section", "Visualización y corte"),
    content: (
      <>
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
      </>
    ),
  };
  const inspectPage = {
    id: "inspect",
    label: b("Selected result", "Resultado seleccionado"),
    content: (
      <>
        <div className="av-pane-readout">
          <EngineeringReadout
            w={w}
            result={displayResult}
            approximation={mode === "models" ? predictionMethod : null}
            mode={mode}
            analysis={analysis}
            route={routing?.path?.edgeIds ?? []}
          />
        </div>
      </>
    ),
  };
  // Airflow merged the flow and operations modes: its result sub-view holds the fan and sensitivity plots of the
  // operating question (when one was calculated) above the selected airway's readout.
  const airflowAnalysis = AnalysisReadout({
    w,
    result: displayResult,
    mode: "operations",
    analysis,
  });
  const airflowInspectPage = {
    id: "inspect",
    label: b("Selected result", "Resultado seleccionado"),
    content: (
      <>
        {airflowAnalysis && (
          <div className="av-pane-readout">{airflowAnalysis}</div>
        )}
        <div className="av-pane-readout">
          <SelectedReadout
            w={w}
            result={displayResult}
            approximation={null}
            route={routing?.path?.edgeIds ?? []}
          />
        </div>
      </>
    ),
  };
  // Rendered once for the models group into `learnedNode` (see Slot), so its model runs outlive a change of sub-view.
  const learned =
    w.valid && w.result ? (
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
    ) : null;
  const pages = {
    design: [
      {
        id: "primary",
        label: b("Draw and move", "Dibujar y mover"),
        content: (
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
          </>
        ),
      },
      {
        id: "node",
        label: b("Junction coordinates", "Coordenadas de unión"),
        content: (
          <>
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

            {!node && (
              <p>
                {b(
                  "Select a junction in the scene or the Draw and move section.",
                  "Seleccione una unión en la escena o la sección Dibujar y mover.",
                )}
              </p>
            )}
          </>
        ),
      },
      {
        id: "airway",
        label: b("Selected airway", "Galería seleccionada"),
        content: (
          <>
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
        ),
      },
      inspectPage,
      viewPage,
    ],
    transport: [
      {
        id: "primary",
        label: b("Release", "Emisión"),
        content: (
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
            <p className="av-hint">
              {b(
                "Passive tracer in mixed airway cells. Geometry supplies volume and travel distance; no fire, heat or emergency-response model.",
                "Trazador pasivo en celdas de galería mezcladas. La geometría determina volumen y distancia; no modela incendios, calor ni respuesta de emergencia.",
              )}
            </p>
          </>
        ),
      },
      {
        id: "schedule",
        label: b("Ventilation change", "Cambio de ventilación"),
        content: (
          <>
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
          </>
        ),
      },
      {
        id: "monitor",
        label: b("Playback and monitor", "Reproducción y monitor"),
        content: (
          <>
            <div className="av-analysis-dock av-transport-dock">
              {t.busy && <button onClick={t.cancel}>{b("Cancel simulation", "Cancelar simulación")}</button>}
              {(t.error || (t.result && !t.result.completed)) && <div role="alert" className="av-error">
                <p>{t.error || t.result?.message}</p>
                <button onClick={() => setToolPage("primary")}>{b("Edit release", "Editar emisión")}</button>
              </div>}
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
          </>
        ),
      },
      {
        id: "ledger",
        label: b("Mass balance and export", "Balance de masa y exportación"),
        content: (
          <>
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
        ),
      },
      viewPage,
    ],
    flow: [
      {
        id: "primary",
        label: b("Fields and paths", "Campos y rutas"),
        content: (
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
          </>
        ),
      },
      conditionsPage,
      equipmentPage,
      inspectPage,
      viewPage,
    ],
    operations: [
      {
        id: "primary",
        label: b("Operating question", "Pregunta operativa"),
        content: (
          <>
            {(
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
              </>
            )}
          </>
        ),
      },
      conditionsPage,
      equipmentPage,
      {
        id: "energy",
        label: b("Energy and baseline", "Energía y referencia"),
        content: (
          <>
            <EnergySummary w={w} />
          </>
        ),
      },
      {
        id: "inspect",
        label: b("Analysis result", "Resultado del análisis"),
        content: (
          <>
            <div className="av-pane-readout">
              <EngineeringReadout
                w={w}
                result={displayResult}
                approximation={mode === "models" ? predictionMethod : null}
                mode={mode}
                analysis={analysis}
                route={routing?.path?.edgeIds ?? []}
              />
            </div>
          </>
        ),
      },
      viewPage,
    ],
    risk: [
      {
        id: "primary",
        label: b("Ensemble evidence", "Evidencia del conjunto"),
        content: (
          <>
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
                    <div>
                      <span>{b("Fan power P05–P95", "Potencia P05–P95")}</span>
                      <strong>
                        {fmt(w.chosenCase.ensemble.powerP05)} --{" "}
                        {fmt(w.chosenCase.ensemble.powerP95)} kW
                      </strong>
                    </div>
                    {selectedIndex >= 0 && (
                      <section
                        className="av-mobile-risk-summary"
                        aria-label={b(
                          "Selected airway uncertainty",
                          "Incertidumbre de galería seleccionada",
                        )}
                      >
                        <h4>{edge?.name[w.lang]}</h4>
                        <p>
                          {b("Flow P05–P95", "Caudal P05–P95")}:{" "}
                          <strong>
                            {fmt(w.chosenCase.ensemble.flowP05[selectedIndex])}{" "}
                            --{" "}
                            {fmt(w.chosenCase.ensemble.flowP95[selectedIndex])}{" "}
                            m³/s
                          </strong>
                        </p>
                        <p>
                          {b("Median", "Mediana")}:{" "}
                          <strong>
                            {fmt(w.chosenCase.ensemble.flowP50[selectedIndex])}{" "}
                            m³/s
                          </strong>
                        </p>
                        <p>
                          {b("Target probability", "Probabilidad de objetivo")}:{" "}
                          <strong>
                            {edge?.target
                              ? `${fmt(w.chosenCase.ensemble.targetProbability[selectedIndex] * 100)}%`
                              : b("no target", "sin objetivo")}
                          </strong>
                        </p>
                      </section>
                    )}
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
        ),
      },
      conditionsPage,
      equipmentPage,
      inspectPage,
      viewPage,
    ],
    models: [
      {
        id: "primary",
        label: b("Learned comparison", "Comparación aprendida"),
        content: (
          <>
            <Slot node={learnedNode} />
          </>
        ),
      },
      conditionsPage,
      equipmentPage,
      inspectPage,
      viewPage,
    ],
  };
  const airflowPages = [
    pages.flow[0],
    {
      id: "duty",
      label: b("Fan duty", "Ventilador"),
      content: (
        <>
          {pages.operations[0].content}
          {pages.operations[3].content}
        </>
      ),
    },
    conditionsPage,
    equipmentPage,
    airflowInspectPage,
    viewPage,
  ];
  const groupPages = {
    design: pages.design,
    airflow: airflowPages,
    transport: pages.transport,
    uncertainty: pages.risk,
    models: pages.models,
  }[group];
  const def = groupById(group)!;
  // The scene is drawn once into `sceneNode` (see Slot) and every sub-view of the group shows it, so a change of
  // sub-view, of group or the shell's Focus never rebuilds the 3D view or loses its camera.
  const scene = (
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
          <strong title={n.name[w.lang]}>{n.name[w.lang]}</strong>
          <span>
            {n.nodes.length} {b("junctions", "uniones")} · {n.edges.length}{" "}
            {b("airways", "galerías")}
          </span>
        </div>
        <div className="av-scene-actions">
          <button
            onClick={() => {
              setToolPage("view");
              setPanel(true);
            }}
            aria-label={b("Display settings", "Opciones de visualización")}
          >
            {b("View", "Vista")}
          </button>
          <button
            onClick={() => {
              setToolPage(mode === "transport" ? "monitor" : "inspect");
              setPanel(true);
            }}
            aria-label={b(
              "Inspect calculated results",
              "Inspeccionar resultados calculados",
            )}
          >
            {b("Results", "Resultados")}
          </button>

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
            <p className="caos-pending" data-state="loading">
              {b("Loading 3D instrument…", "Cargando instrumento 3D…")}
            </p>
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
              if (mode === "design" && tool === "select")
                setToolPage("airway");
              w.setSelected(id);
              setNodeId(null);
            }}
            onNode={(id) => {
              if (mode === "design") {
                connect(id);
                if (tool !== "connect") setToolPage("node");
              } else setNodeId(id);
            }}
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
    </section>
  );
  // One tool section of the pane: the open sub-view's content.
  const page = (id: string) => (
    <div className="av-tool-page">
      {groupPages.find((p) => p.id === id)?.content}
    </div>
  );
  const paneHead = (
    <div className="av-control-title">
      <h2>{def.title[w.lang]}</h2>
      <button
        type="button"
        className="av-panel-close icon-btn"
        aria-label={b("Hide tool parameters", "Ocultar parámetros")}
        onClick={() => setPanel(false)}
      >
        ×
      </button>
    </div>
  );
  const subTabs = (render: (id: string) => ReactNode) => (
    <SubTabs
      ariaLabel={b("Tool section", "Sección de herramientas")}
      value={sub}
      onChange={setSub}
      tabs={def.subs.map((sv) => ({
        id: sv.id,
        label: sv[w.lang],
        content: render(sv.id),
      }))}
    />
  );
  // The readiness note takes one line of the tool pane the group already has (ADR-0071: no new row): the catalog rows
  // the group reads, and with them the model rows in the Models group.
  const note = <ReadinessNote ids={VIEW_ROWS[group === "models" ? "models" : "workbench"]} />;
  const paneLabel = b("Tool parameters", "Parámetros de la herramienta");
  const modeClass = `av-mode av-mode-${group}${panel ? " av-panel-open" : ""}`;
  // In the App the sub-views are the row of tabs under the group row and the pane floats over the scene; in Focus the
  // stage is the scene alone, so the row moves into the pane, which clears the shell's label and HUD.
  const content = focusOn ? (
    <div className={`${modeClass} av-mode-focus`}>
      <Slot node={sceneNode} className="av-scene-slot" />
      <aside className="av-controls" aria-label={paneLabel}>
        {paneHead}
        {note}
        {subTabs(page)}
      </aside>
    </div>
  ) : (
    subTabs((id) => (
      <div className={modeClass}>
        <Slot node={sceneNode} className="av-scene-slot" />
        <aside className="av-controls" aria-label={paneLabel}>
          {paneHead}
          {note}
          {page(id)}
        </aside>
      </div>
    ))
  );
  const frameMain =
    group === "design"
      ? {
          label: { en: "Junctions · airways", es: "Uniones · galerías" },
          value: `${n.nodes.length} · ${n.edges.length}`,
        }
      : group === "airflow"
        ? {
            label: { en: "Mass residual · m³/s", es: "Residuo de masa · m³/s" },
            value: displayResult
              ? formatNumber(displayResult.massResidual, w.lang, { digits: 2 })
              : "--",
          }
        : group === "transport"
          ? {
              label: { en: "Tracer time", es: "Tiempo del trazador" },
              value: transportFrame
                ? `${fixed(transportFrame.timeSeconds, 1, w.lang)} s`
                : "--",
            }
          : group === "uncertainty"
            ? {
                label: { en: "Resistance CV", es: "CV de resistencia" },
                value:
                  w.matchesBake && w.chosenCase?.ensemble
                    ? `${fixed(w.chosenCase.ensemble.cv * 100, 1, w.lang)} %`
                    : "--",
              }
            : {
                label: { en: "Field shown", es: "Campo mostrado" },
                value: predictionMethod ?? (w.lang === "es" ? "numérico" : "numerical"),
              };
  const short = displayResult
    ? displayResult.shortfalls.filter(
        (v, i) => effective.edges[i].target > 0 && v > 1e-6,
      ).length
    : null;
  const hud = [
    {
      label: { en: "Total airflow · m³/s", es: "Caudal total · m³/s" },
      value: displayResult ? fixed(displayResult.totalIntake, 2, w.lang) : "--",
    },
    {
      label: { en: "Fan power · kW", es: "Potencia · kW" },
      value: displayResult ? fixed(displayResult.fanPowerKW, 2, w.lang) : "--",
    },
    {
      label: { en: "Targets short", es: "Objetivos insuficientes" },
      value: short === null ? "--" : `${short} / ${w.targets}`,
    },
    frameMain,
  ];
  return {
    scene,
    content,
    learned,
    hud,
    compareToBaseline: () => {
      setMetric("change");
      setFlowTool("field");
    },
  };
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

function OperatingInputs({
  w,
  scope = "global",
}: {
  w: WorkbenchState;
  scope?: "global" | "edge";
}) {
  const b = w.b,
    edge = w.edge;
  return (
    <section className="av-field-group">
      {scope === "global" && (
        <>
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
          <p className="av-hint">
            {b(
              "Fan speed and the global resistance scale are in the Operating point section of the rail.",
              "La velocidad del ventilador y la escala global de resistencia están en la sección Punto operativo del panel.",
            )}
          </p>
        </>
      )}
      {scope === "edge" && edge && (
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
                unit="Pa·s²/m⁶"
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
  result,
  approximation,
  mode,
  analysis,
  route,
}: {
  w: WorkbenchState;
  result: Result | null;
  approximation: string | null;
  mode: Mode;
  analysis: "duty" | "sensitivity" | "baseline";
  route: string[];
}) {
  return (
    AnalysisReadout({ w, result, mode, analysis }) ?? (
      <SelectedReadout
        w={w}
        result={result}
        approximation={approximation}
        route={route}
      />
    )
  );
}

/** The chart of the operating question or of the recorded ensemble, or null when the open view has none to draw. */
function AnalysisReadout({
  w,
  result,
  mode,
  analysis,
}: {
  w: WorkbenchState;
  result: Result | null;
  mode: Mode;
  analysis: "duty" | "sensitivity" | "baseline";
}): ReactNode {
  const b = w.b,
    edge = w.edge,
    i = w.selectedIndex,
    r = result;
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
                {fixed(p.elasticity, 3, w.lang)} · {fixed(p.powerDelta, 2, w.lang)} kW
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
  return null;
}

function SelectedReadout({
  w,
  result,
  approximation,
  route,
}: {
  w: WorkbenchState;
  result: Result | null;
  approximation: string | null;
  route: string[];
}) {
  const b = w.b,
    edge = w.edge,
    i = w.selectedIndex,
    r = result;
  return (
    <div className="av-selected-readout">
      <div>
        <span>
          {approximation
            ? b(
                "Selected airway · approximation",
                "Galería seleccionada · aproximación",
              )
            : b("Selected airway", "Galería seleccionada")}
        </span>
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
          {formatNumber(r?.massResidual, w.lang, { digits: 2 })} /{" "}
          {formatNumber(r?.pressureResidual, w.lang, { digits: 2 })}
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

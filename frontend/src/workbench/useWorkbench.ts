import { useEffect, useMemo, useRef, useState } from "react";
import { useShellLang, useThemeStore } from "@fasl-work/caos-app-shell";
import type {
  Network,
  Options,
  Result,
  CurvePoint,
  SensitivityPoint,
  OptimizationResult,
} from "../contracts";
import { DEFAULT_OPTIONS, validateNetwork, validateOptions } from "../engine";
import useEngine from "../useEngine";
import {
  download,
  csvCell,
  persistProject,
  readSaved,
  serializeProject,
  validateProject,
} from "../storage";
import type { AnalysisEnsemble } from "../contracts";
type Catalog = {
  cases: { network: Network; result: Result; ensemble?: AnalysisEnsemble }[];
  benchmark: unknown;
};
type Snapshot = { network: Network; options: Options };
type Baseline = { network: Network; options: Options; result: Result };
const clone = <T>(v: T): T => structuredClone(v);

export default function useWorkbench() {
  const lang = useShellLang();
  const theme = useThemeStore((s) => s.theme);
  const b = (en: string, es: string) => (lang === "en" ? en : es);
  const [focus, setFocus] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [network, setNetwork] = useState<Network | null>(null),
    [options, setOptions] = useState<Options>(clone(DEFAULT_OPTIONS)),
    [result, setResult] = useState<Result | null>(null);
  const [resultInput, setResultInput] = useState<Snapshot | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [level, setLevel] = useState<number | null>(null),
    [cameraReset, setCameraReset] = useState(0);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [analysisBusy, setAnalysisBusy] = useState(false),
    [curveData, setCurveData] = useState<CurvePoint[]>([]),
    [sensitivityData, setSensitivityData] = useState<SensitivityPoint[]>([]),
    [optimum, setOptimum] = useState<OptimizationResult | null>(null);
  const [hours, setHours] = useState(8000),
    [tariff, setTariff] = useState(0.12);
  const [history, setHistory] = useState<Snapshot[]>([]),
    [future, setFuture] = useState<Snapshot[]>([]);
  const request = useEngine();
  const revision = useRef(0),
    analysisRevision = useRef(0);
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
  useEffect(() => {
    if (network && !network.edges.some((e) => e.id === selected))
      setSelected(network.edges[0]?.id ?? null);
  }, [network, selected]);
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
    network.nodes.length === baseline.network.nodes.length &&
    network.nodes.every(
      (node, i) => node.id === baseline.network.nodes[i].id,
    ) &&
    network.edges.every((e, i) => {
      const previous = baseline.network.edges[i];
      return (
        e.id === previous.id && e.from === previous.from && e.to === previous.to
      );
    });
  const levels = [
    ...new Set(
      network?.edges.filter((e) => e.kind === "working").map((e) => e.level) ??
        [],
    ),
  ].sort((a, b) => a - b);
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
    if (!effective || !result || !valid) return;
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
      setNotice(
        b(
          "Network validated and loaded locally.",
          "Red validada y cargada localmente.",
        ),
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
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
    if (!valid) return;
    setBaseline({
      network: clone(network!),
      options: clone(options),
      result: clone(result),
    });
    setNotice(
      b("Baseline saved for comparison.", "Referencia guardada para comparar."),
    );
  }
  const valid =
    !!result?.converged &&
    !busy &&
    resultInput?.network === network &&
    resultInput?.options === options;
  const targets = effective?.edges.filter((e) => e.target > 0).length ?? 0;
  const shortfalls =
    result?.shortfalls.filter(
      (v, i) => (effective?.edges[i]?.target ?? 0) > 0 && v > 1e-6,
    ).length ?? 0;
  const safeBaseline = baselineValid ? baseline!.result : null;
  return {
    lang,
    b,
    theme,
    network,
    effective,
    catalog,
    options,
    result,
    valid,
    selected,
    setSelected,
    selectedIndex,
    edge,
    chosenCase,
    matchesBake,
    baseline,
    baselineValid,
    safeBaseline,
    levels,
    targets,
    shortfalls,
    busy,
    analysisBusy,
    curveData,
    sensitivityData,
    optimum,
    hours,
    setHours,
    tariff,
    setTariff,
    focus,
    setFocus,
    level,
    setLevel,
    cameraReset,
    setCameraReset,
    closed,
    notice,
    setNotice,
    error,
    setError,
    history,
    future,
    change,
    choose,
    undo,
    redo,
    override,
    updateFan,
    analyze,
    exportProject,
    exportCSV,
    setBaselineNow,
    importText,
  };
}
export type WorkbenchState = ReturnType<typeof useWorkbench>;

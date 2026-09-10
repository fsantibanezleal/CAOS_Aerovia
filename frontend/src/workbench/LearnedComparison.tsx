import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Play, RotateCcw } from "lucide-react";
import Plot from "../components/Plot";
import ToolPages from "./ToolPages";
import {
  predictSurrogate,
  type LearnedMethod,
  type Network,
  type Options,
  type Result,
  type SurrogateResponse,
} from "../learned";
import "./learned-comparison.css";

interface Props {
  network: Network;
  options: Options;
  reference: Result;
  selected: string | null;
  onSelect: (prediction: Result | null, methodId: string | null) => void;
  lang: "en" | "es";
  onAirwaySelect?: (airwayId: string) => void;
}
const methods: LearnedMethod[] = ["topology-mlp", "graph-surrogate"];
const names = {
  "topology-mlp": { en: "Topology MLP", es: "MLP de topología" },
  "graph-surrogate": { en: "Graph surrogate", es: "Modelo de grafos" },
};
const colors = { "topology-mlp": "#0b9cbb", "graph-surrogate": "#ba7624" };
interface ResponseSnapshot {
  network: Network;
  options: Options;
  reference: Result;
  run: number;
  responses: Partial<Record<LearnedMethod, SurrogateResponse>>;
}

export default function LearnedComparison({
  network,
  options,
  reference,
  selected,
  onSelect,
  lang,
  onAirwaySelect,
}: Props) {
  const b = (en: string, es: string) => (lang === "es" ? es : en);
  const [snapshot, setSnapshot] = useState<ResponseSnapshot | null>(null);
  const [active, setActive] = useState<LearnedMethod>("topology-mlp");
  const [view, setView] = useState<"error" | "flow" | "pressure">("error");
  const [run, setRun] = useState(0);
  const [page, setPage] = useState("run");
  const latestSelect = useRef(onSelect);
  latestSelect.current = onSelect;
  useEffect(() => {
    latestSelect.current(null, null);
  }, [network, options, reference]);
  useEffect(() => {
    if (!run) return;
    let current = true;
    void Promise.all(
      methods.map(
        async (method) =>
          [
            method,
            await predictSurrogate(network, options, method, reference),
          ] as const,
      ),
    ).then((values) => {
      if (current) {
        setSnapshot({
          network,
          options,
          reference,
          run,
          responses: Object.fromEntries(values),
        });
        setPage("accuracy");
      }
    });
    return () => {
      current = false;
    };
  }, [network, options, reference, run]);
  // Identity is checked during render: effects cannot expose a previous input's field.
  const currentSnapshot =
    snapshot?.network === network &&
    snapshot.options === options &&
    snapshot.reference === reference &&
    snapshot.run === run;
  const responses = currentSnapshot ? snapshot.responses : {};
  const busy = run > 0 && !currentSnapshot;
  const response = responses[active];
  const prediction = response?.prediction;
  const series = prediction
    ? view === "error"
      ? [
          {
            label: b(
              "Prediction minus reference",
              "Predicción menos referencia",
            ),
            color: colors[active],
            values: prediction.errors.map((y, x) => ({ x: x + 1, y })),
          },
        ]
      : [
          {
            label: b("Numerical reference", "Referencia numérica"),
            color: "#788e99",
            values: (view === "flow"
              ? reference.flows
              : reference.pressures
            ).map((y, x) => ({ x: x + 1, y })),
          },
          {
            label: names[active][lang],
            color: colors[active],
            values: (view === "flow"
              ? prediction.result.flows
              : prediction.result.pressures
            ).map((y, x) => ({ x: x + 1, y })),
          },
        ]
    : [];
  const fmt = (value: number, digits = 3) =>
    value.toLocaleString(lang, { maximumFractionDigits: digits });
  const localizedReason =
    response?.status === "out-of-domain" && lang === "es"
      ? "Fuera del dominio entrenado: la topología, curva del ventilador, fronteras, cierres o razones de resistencia difieren de la calibración publicada. Use la referencia numérica; no se sustituye el modelo de forma oculta."
      : response?.reason;
  return (
    <section
      className="av-learned"
      aria-label={b(
        "Learned model comparison",
        "Comparación de modelos aprendidos",
      )}
    >
      <div
        className="av-learned-tabs"
        role="tablist"
        aria-label={b("Learned method", "Método aprendido")}
      >
        {methods.map((method) => (
          <button
            key={method}
            role="tab"
            aria-selected={active === method}
            onClick={() => setActive(method)}
          >
            {names[method][lang]}
            {responses[method]?.status === "supported" && <span>WASM</span>}
          </button>
        ))}
      </div>

      <ToolPages
        label={b("Model section", "Secci\u00f3n del modelo")}
        value={page}
        onChange={setPage}
        pages={[
          {
            id: "run",
            label: b("Run models", "Ejecutar modelos"),
            content: (
              <>
                {" "}
                <div className="av-learned-heading">
                  <BrainCircuit size={20} />
                  <div>
                    <h3>
                      {b(
                        "Learned airflow screening",
                        "Exploración del flujo con aprendizaje",
                      )}
                    </h3>
                    <p>
                      {b(
                        "Evaluate two trained approximations against the current numerical solution.",
                        "Evalúe dos aproximaciones entrenadas contra la solución numérica actual.",
                      )}
                    </p>
                  </div>
                </div>
                <p className="av-hint">
                  {b(
                    "Calibrated topology and resistance ratios are required; fan-speed scaling is exact. Inspect errors before showing a predicted field.",
                    "Se requiere la topología calibrada y sus razones de resistencia; la escala de velocidad es exacta. Revise los errores antes de mostrar un campo predicho.",
                  )}
                </p>
                <div className="av-learned-actions">
                  <button
                    onClick={() => setRun((value) => value + 1)}
                    disabled={busy || !reference.converged}
                  >
                    <Play size={14} />
                    {busy
                      ? b("Running models…", "Ejecutando modelos…")
                      : b("Run both models", "Ejecutar ambos modelos")}
                  </button>
                  <button
                    onClick={() => onSelect(null, null)}
                    disabled={!selected}
                  >
                    <RotateCcw size={14} />
                    {b("Numerical field", "Campo numérico")}
                  </button>
                </div>
                {busy && (
                  <p role="status">
                    {b(
                      "Verifying model checksums and running local WASM inference…",
                      "Verificando sumas de comprobación y ejecutando inferencia WASM local…",
                    )}
                  </p>
                )}
                {!response && !busy && (
                  <p className="av-hint">
                    {b(
                      "Training and cross-case evidence: Benchmark.",
                      "Entrenamiento y evidencia entre casos: Benchmark.",
                    )}
                  </p>
                )}
              </>
            ),
          },
          {
            id: "accuracy",
            label: b("Accuracy", "Precisi\u00f3n"),
            content: (
              <>
                {" "}
                {response && !prediction && (
                  <p className="av-learned-domain" role="status">
                    <strong>
                      {response.status === "out-of-domain"
                        ? b(
                            "Outside training domain",
                            "Fuera del dominio de entrenamiento",
                          )
                        : b("Model unavailable", "Modelo no disponible")}
                    </strong>
                    <br />
                    {localizedReason}
                  </p>
                )}
                {prediction ? (
                  <>
                    {" "}
                    <div className="av-learned-metrics">
                      <div>
                        <span>
                          {b("Mean flow error", "Error medio de caudal")}
                        </span>
                        <strong>
                          {fmt(prediction.metrics.flowMAE)} <small>m³/s</small>
                        </strong>
                      </div>
                      <div>
                        <span>
                          {b("Maximum flow error", "Error máximo de caudal")}
                        </span>
                        <strong>
                          {fmt(prediction.metrics.flowMaxError)}{" "}
                          <small>m³/s</small>
                        </strong>
                      </div>
                      <div>
                        <span>
                          {b("Pressure closure", "Cierre de presión")}
                        </span>
                        <strong>
                          {fmt(prediction.result.pressureResidual, 2)}{" "}
                          <small>Pa</small>
                        </strong>
                      </div>
                      <div>
                        <span>
                          {b("Nodal imbalance", "Desequilibrio nodal")}
                        </span>
                        <strong>
                          {prediction.result.massResidual.toExponential(2)}{" "}
                          <small>m³/s</small>
                        </strong>
                      </div>
                    </div>
                    <p className="av-hint">
                      {b("Inference completed", "Inferencia completada")} ·{" "}
                      {fmt(response.diagnostics.inferenceMs ?? 0, 2)} ms ·{" "}
                      {b(
                        "physical residuals are separate from execution success",
                        "los residuos físicos son independientes del éxito de ejecución",
                      )}
                      .
                    </p>
                    <button
                      className="av-learned-show"
                      onClick={() => onSelect(prediction.result, active)}
                      aria-pressed={selected === active}
                    >
                      {selected === active
                        ? b(
                            "Predicted field is visible",
                            "Campo predicho visible",
                          )
                        : b(
                            "Show predicted field in the mine",
                            "Mostrar campo predicho en la mina",
                          )}
                    </button>
                  </>
                ) : (
                  !response && (
                    <p className="av-hint">
                      {b(
                        "Run both models to inspect their actual errors against the numerical reference.",
                        "Ejecute ambos modelos para inspeccionar sus errores contra la referencia num\u00e9rica.",
                      )}
                    </p>
                  )
                )}
                <button
                  onClick={() => onSelect(null, null)}
                  disabled={!selected}
                >
                  <RotateCcw size={14} />
                  {b("Numerical field", "Campo num\u00e9rico")}
                </button>
              </>
            ),
          },
          {
            id: "comparison",
            label: b("Comparison", "Comparaci\u00f3n"),
            content: prediction ? (
              <>
                {" "}
                <label>
                  {b("Inspect", "Inspeccionar")}
                  <select
                    value={view}
                    onChange={(event) =>
                      setView(event.target.value as typeof view)
                    }
                  >
                    <option value="error">
                      {b("Signed branch error", "Error con signo por galería")}
                    </option>
                    <option value="flow">
                      {b("Flow comparison", "Comparación de caudales")}
                    </option>
                    <option value="pressure">
                      {b("Pressure comparison", "Comparación de presiones")}
                    </option>
                  </select>
                </label>
                <Plot
                  series={series}
                  title={
                    view === "error"
                      ? b(
                          "Where the approximation differs",
                          "Dónde difiere la aproximación",
                        )
                      : view === "flow"
                        ? b("Airway flow", "Caudal por galería")
                        : b("Junction pressure", "Presión por unión")
                  }
                  xlabel={
                    view === "pressure"
                      ? b("Junction index", "Índice de unión")
                      : b("Airway index", "Índice de galería")
                  }
                  ylabel={view === "pressure" ? "Pa" : "m³/s"}
                  onSelect={
                    view === "pressure"
                      ? undefined
                      : (x) => {
                          const edge = network.edges[Math.round(x) - 1];
                          if (edge) onAirwaySelect?.(edge.id);
                        }
                  }
                />
                <button
                  className="av-learned-show"
                  onClick={() => onSelect(prediction.result, active)}
                  aria-pressed={selected === active}
                >
                  {selected === active
                    ? b("Predicted field is visible", "Campo predicho visible")
                    : b(
                        "Show predicted field in the mine",
                        "Mostrar campo predicho en la mina",
                      )}
                </button>
              </>
            ) : (
              <p className="av-hint">
                {b(
                  "Run both models to inspect their actual errors against the numerical reference.",
                  "Ejecute ambos modelos para inspeccionar sus errores contra la referencia num\u00e9rica.",
                )}
              </p>
            ),
          },
        ]}
      />
    </section>
  );
}

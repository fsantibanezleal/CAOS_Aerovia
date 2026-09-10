import { useEffect, useRef, useState } from "react";
import {
  Callout,
  Cite,
  Equation,
  Refs,
  useLangStore,
  useShellLang,
} from "@fasl-work/caos-app-shell";
import { Play } from "lucide-react";
import Plot from "../components/Plot";
import { solveNetwork } from "../engine/solver";
import type { Result } from "../contracts";
import {
  predictSurrogate,
  type BenchmarkRow,
  type LearnedMethod,
  type ScienceArtifact,
  type SurrogateResponse,
} from "../learned";
import type { CaseArtifact, CatalogArtifact } from "./artifacts";

export const methods: LearnedMethod[] = ["topology-mlp", "graph-surrogate"];
const colors = {
  "topology-mlp": "var(--color-accent)",
  "graph-surrogate": "var(--color-warn)",
  browser: "var(--color-good)",
};
export const metric = (value: number | null | undefined, digits = 4) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(
        useLangStore.getState().lang === "es" ? "es-CL" : "en-US",
        { maximumFractionDigits: digits },
      )
    : "--";
export const scientific = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toExponential(3)
    : "--";
export const methodName = (id: string, es: boolean) =>
  id === "topology-mlp"
    ? es
      ? "MLP de topología"
      : "Topology MLP"
    : id === "graph-surrogate"
      ? es
        ? "Modelo de grafos"
        : "Graph surrogate"
      : id === "graph-surrogate-family-holdout"
        ? es
          ? "Grafo con familia reservada"
          : "Graph family holdout"
        : id === "scipy-reference"
          ? es
            ? "Referencia SciPy"
            : "SciPy reference"
          : id === "cuda-newton"
            ? "CUDA Newton"
            : id;
const difference = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);

export function ReferenceLive({ catalog }: { catalog: CatalogArtifact }) {
  const es = useShellLang() === "es";
  const [selected, setSelected] = useState(catalog.cases[0].network.id);
  const item = catalog.cases.find((c) => c.network.id === selected)!;
  return (
    <section>
      <h2>
        {es
          ? "Volver a calcular la referencia en el navegador"
          : "Recompute the reference in this browser"}
      </h2>
      <p>
        {es
          ? "Seleccione un caso registrado y ejecute el solucionador real sobre sus opciones exactas. El gráfico muestra diferencias por galería frente a la solución SciPy publicada. Esto prueba concordancia numérica sobre la misma entrada; no utiliza valores de referencia como salida del motor."
          : "Select a recorded case and run the real solver on its exact options. The plot shows airway differences against the published SciPy solution. This tests numerical agreement on identical input; it does not use reference values as the engine output."}{" "}
        <Cite id="scipytrf" />
      </p>
      <label>
        {es ? "Caso de comparación" : "Comparison case"}{" "}
        <select
          aria-label={es ? "Caso de comparación" : "Comparison case"}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {catalog.cases.map((c) => (
            <option key={c.network.id} value={c.network.id}>
              {c.network.name[es ? "es" : "en"]}
            </option>
          ))}
        </select>
      </label>
      <ReferenceRun key={selected} item={item} />
      <Refs
        ids={["scipytrf", "mcpherson1993"]}
        label={es ? "Referencias" : "References"}
      />
    </section>
  );
}
function ReferenceRun({ item }: { item: CaseArtifact }) {
  const es = useShellLang() === "es";
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    try {
      setError(null);
      setResult(solveNetwork(item.network, item.options));
    } catch (reason) {
      setResult(null);
      setError(
        reason instanceof Error ? reason.message : "Calculation failed.",
      );
    }
  };
  const errors = result ? difference(result.flows, item.result.flows) : [];
  return (
    <>
      <p>
        <button type="button" onClick={run}>
          <Play size={14} />
          {es ? "Ejecutar cálculo exacto local" : "Run exact local calculation"}
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p role="status">
            {result.converged
              ? es
                ? "La solución local satisface los límites de residuos."
                : "The local solution meets residual limits."
              : es
                ? "La solución local no fue aceptada."
                : "The local solution was not accepted."}{" "}
            {result.message}
          </p>
          <table>
            <thead>
              <tr>
                <th>{es ? "Métrica" : "Metric"}</th>
                <th>{es ? "Navegador actual" : "Current browser"}</th>
                <th>{es ? "Referencia publicada" : "Published reference"}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  {es
                    ? "Desequilibrio nodal máximo (m³/s)"
                    : "Maximum nodal imbalance (m³/s)"}
                </th>
                <td>{scientific(result.massResidual)}</td>
                <td>{scientific(item.result.massResidual)}</td>
              </tr>
              <tr>
                <th scope="row">
                  {es
                    ? "Residuo de presión máximo (Pa)"
                    : "Maximum pressure residual (Pa)"}
                </th>
                <td>{scientific(result.pressureResidual)}</td>
                <td>{scientific(item.result.pressureResidual)}</td>
              </tr>
              <tr>
                <th scope="row">
                  {es ? "Demanda eléctrica (kW)" : "Electrical demand (kW)"}
                </th>
                <td>{metric(result.fanPowerKW)}</td>
                <td>{metric(item.result.fanPowerKW)}</td>
              </tr>
              <tr>
                <th scope="row">
                  {es
                    ? "Máxima diferencia de caudal (m³/s)"
                    : "Maximum flow difference (m³/s)"}
                </th>
                <td>{scientific(Math.max(...errors.map(Math.abs)))}</td>
                <td>{es ? "Base de comparación" : "Comparison baseline"}</td>
              </tr>
              <tr>
                <th scope="row">
                  {es
                    ? "Tiempo de esta ejecución (ms)"
                    : "This execution time (ms)"}
                </th>
                <td>{metric(result.elapsedMs, 2)}</td>
                <td>
                  {es
                    ? "Tiempo de la corrida registrada; otro equipo"
                    : "Recorded-run timing; a different machine"}
                </td>
              </tr>
            </tbody>
          </table>
          <Plot
            title={
              es ? "Error con signo por galería" : "Signed error by airway"
            }
            xlabel={es ? "Índice de galería" : "Airway index"}
            ylabel="m³/s"
            format={(v) => scientific(v)}
            series={[
              {
                label: es ? "Navegador menos SciPy" : "Browser minus SciPy",
                color: colors.browser,
                values: errors.map((y, x) => ({ x: x + 1, y })),
              },
            ]}
          />
          <details>
            <summary>
              {es
                ? "Inspeccionar cada galería y su valor"
                : "Inspect each airway and its value"}
            </summary>
            <table>
              <thead>
                <tr>
                  <th>{es ? "Galería" : "Airway"}</th>
                  <th>{es ? "Navegador (m³/s)" : "Browser (m³/s)"}</th>
                  <th>SciPy (m³/s)</th>
                  <th>Δ (m³/s)</th>
                </tr>
              </thead>
              <tbody>
                {item.network.edges.map((edge, i) => (
                  <tr key={edge.id}>
                    <th scope="row">{edge.name[es ? "es" : "en"]}</th>
                    <td>{metric(result.flows[i])}</td>
                    <td>{metric(item.result.flows[i])}</td>
                    <td>{scientific(errors[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </>
  );
}

export function HeldoutLive({
  catalog,
  science,
}: {
  catalog: CatalogArtifact;
  science: ScienceArtifact;
}) {
  const es = useShellLang() === "es";
  const fixtures = science.heldoutFixtures;
  const [selected, setSelected] = useState(fixtures[0]?.sampleId ?? "");
  const fixture = fixtures.find((f) => f.sampleId === selected) ?? fixtures[0];
  const item = catalog.cases.find((c) => c.network.id === fixture?.networkId);
  if (!fixture || !item)
    return (
      <p role="alert">
        {es
          ? "Falta una entrada de prueba reservada compatible. No se sustituyen métricas."
          : "A compatible held-out fixture is missing. No substitute metrics are inferred."}
      </p>
    );
  return (
    <section>
      <h2>
        {es
          ? "Inferencia real sobre entrada reservada"
          : "Real inference on a held-out input"}
      </h2>
      <p>
        {es
          ? "Estas entradas pertenecen a la partición de prueba registrada, no a puntos usados para seleccionar el checkpoint. El botón ejecuta el motor clásico y ambos modelos exportados en este navegador. Todos reciben la misma red, resistencias y velocidad; sus errores se comparan con la misma referencia numérica guardada."
          : "These inputs belong to the recorded test partition, not points used to select the checkpoint. The button runs the classical engine and both exported models in this browser. All receive the same network, resistances and speed; errors compare to the same saved numerical reference."}{" "}
        <Cite id="sklearnleakage" />
      </p>
      <label>
        {es ? "Entrada reservada" : "Held-out input"}{" "}
        <select
          aria-label={es ? "Entrada reservada" : "Held-out input"}
          value={fixture.sampleId}
          onChange={(event) => setSelected(event.target.value)}
        >
          {fixtures.map((f) => (
            <option key={f.sampleId} value={f.sampleId}>
              {catalog.cases.find((c) => c.network.id === f.networkId)?.network
                .name[es ? "es" : "en"] ?? f.networkId}{" "}
              · {es ? "muestra" : "sample"} {f.sampleIndex}
            </option>
          ))}
        </select>
      </label>
      <HeldoutRun key={fixture.sampleId} item={item} fixture={fixture} />
      <Refs
        ids={["sklearnleakage", "sklearnmetrics", "onnxweb"]}
        label={es ? "Referencias" : "References"}
      />
    </section>
  );
}
function HeldoutRun({
  item,
  fixture,
}: {
  item: CaseArtifact;
  fixture: ScienceArtifact["heldoutFixtures"][number];
}) {
  const es = useShellLang() === "es";
  const [responses, setResponses] = useState<
    Partial<Record<LearnedMethod, SurrogateResponse>>
  >({});
  const [classical, setClassical] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [selected, setSelected] = useState<LearnedMethod>("topology-mlp");
  const [view, setView] = useState<"error" | "flow">("error");
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  async function run() {
    const token = ++epoch.current;
    setBusy(true);
    setFailure(null);
    setResponses({});
    setClassical(null);
    try {
      const exact = solveNetwork(item.network, fixture.options);
      if (!exact.converged)
        throw new Error(exact.message ?? "Classical reference rejected.");
      const pairs = await Promise.all(
        methods.map(
          async (method) =>
            [
              method,
              await predictSurrogate(
                item.network,
                fixture.options,
                method,
                fixture.reference,
              ),
            ] as const,
        ),
      );
      if (epoch.current === token) {
        setClassical(exact);
        setResponses(Object.fromEntries(pairs));
      }
    } catch (reason) {
      if (epoch.current === token)
        setFailure(
          reason instanceof Error ? reason.message : "Inference failed.",
        );
    } finally {
      if (epoch.current === token) setBusy(false);
    }
  }
  const current = responses[selected];
  const prediction = current?.prediction;
  const errors = classical
    ? difference(classical.flows, fixture.reference.flows)
    : [];
  const series = prediction
    ? view === "error"
      ? [
          {
            label: methodName(selected, es),
            color: colors[selected],
            values: prediction.errors.map((y, x) => ({ x: x + 1, y })),
          },
          ...(classical
            ? [
                {
                  label: es ? "Motor clásico" : "Classical engine",
                  color: colors.browser,
                  values: errors.map((y, x) => ({ x: x + 1, y })),
                },
              ]
            : []),
        ]
      : [
          {
            label: es ? "Referencia" : "Reference",
            color: "var(--color-fg-subtle)",
            values: fixture.reference.flows.map((y, x) => ({ x: x + 1, y })),
          },
          {
            label: methodName(selected, es),
            color: colors[selected],
            values: prediction.result.flows.map((y, x) => ({ x: x + 1, y })),
          },
        ]
    : [];
  return (
    <>
      <p>
        {es ? "Velocidad común" : "Common speed"}:{" "}
        {metric(fixture.options.speed * 100, 1)}% ·{" "}
        {es ? "Entrada de prueba" : "Test input"} {fixture.sampleIndex}
      </p>
      <button type="button" disabled={busy} onClick={() => void run()}>
        <Play size={14} />
        {busy
          ? es
            ? "Ejecutando motores…"
            : "Running engines…"
          : es
            ? "Ejecutar referencia y ambos modelos"
            : "Run reference and both models"}
      </button>
      {busy && (
        <p role="status">
          {es
            ? "Verificando modelos y ejecutando inferencia WASM local. La primera carga se incluye en tiempo total, separada del tiempo de inferencia."
            : "Verifying models and running local WASM inference. Initial loading is included in total time and separated from inference time."}
        </p>
      )}
      {failure && <p role="alert">{failure}</p>}
      {classical && (
        <table>
          <thead>
            <tr>
              <th>
                {es ? "Método en este navegador" : "Method in this browser"}
              </th>
              <th>{es ? "Estado" : "Status"}</th>
              <th>MAE Q (m³/s)</th>
              <th>{es ? "Máx. error Q" : "Max Q error"} (m³/s)</th>
              <th>{es ? "Residuo p" : "p residual"} (Pa)</th>
              <th>{es ? "Inferencia / total" : "Inference / total"} (ms)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                {es ? "Motor clásico exacto" : "Exact classical engine"}
              </th>
              <td>{es ? "Aceptado" : "Accepted"}</td>
              <td>
                {scientific(
                  errors.reduce((sum, x) => sum + Math.abs(x), 0) /
                    errors.length,
                )}
              </td>
              <td>{scientific(Math.max(...errors.map(Math.abs)))}</td>
              <td>{scientific(classical.pressureResidual)}</td>
              <td>
                {metric(classical.elapsedMs, 2)} /{" "}
                {metric(classical.elapsedMs, 2)}
              </td>
            </tr>
            {methods.map((method) => {
              const response = responses[method];
              const p = response?.prediction;
              return (
                <tr key={method}>
                  <th scope="row">{methodName(method, es)}</th>
                  <td>
                    {p
                      ? es
                        ? "Aproximación ejecutada"
                        : "Approximation executed"
                      : response?.status === "out-of-domain"
                        ? es
                          ? "Fuera de dominio"
                          : "Out of domain"
                        : es
                          ? "No disponible o fallido"
                          : "Unavailable or failed"}
                  </td>
                  <td>{metric(p?.metrics.flowMAE)}</td>
                  <td>{metric(p?.metrics.flowMaxError)}</td>
                  <td>{metric(p?.result.pressureResidual, 2)}</td>
                  <td>
                    {metric(response?.diagnostics.inferenceMs, 2)} /{" "}
                    {metric(response?.diagnostics.totalMs, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {Object.entries(responses)
        .filter(([, r]) => !r.prediction)
        .map(([id, r]) => (
          <p key={id} role="status">
            {methodName(id, es)}:{" "}
            {es
              ? "No se generó predicción. Detalle técnico:"
              : "No prediction was generated. Technical detail:"}{" "}
            {r.reason}
          </p>
        ))}
      {prediction && (
        <>
          <label>
            {es ? "Método a inspeccionar" : "Inspect method"}{" "}
            <select
              aria-label={es ? "Método a inspeccionar" : "Inspect method"}
              value={selected}
              onChange={(event) =>
                setSelected(event.target.value as LearnedMethod)
              }
            >
              {methods.map((method) => (
                <option value={method} key={method}>
                  {methodName(method, es)}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            {es ? "Magnitud" : "Quantity"}{" "}
            <select
              aria-label={es ? "Magnitud" : "Quantity"}
              value={view}
              onChange={(event) =>
                setView(event.target.value as "error" | "flow")
              }
            >
              <option value="error">
                {es ? "Error con signo" : "Signed error"}
              </option>
              <option value="flow">{es ? "Caudal" : "Flow"}</option>
            </select>
          </label>
          <Plot
            title={
              es
                ? "Predicción y referencia sobre la misma entrada"
                : "Prediction and reference on the same input"
            }
            xlabel={es ? "Índice de galería" : "Airway index"}
            ylabel="m³/s"
            format={(v) => (view === "error" ? scientific(v) : metric(v, 2))}
            series={series}
          />
          <details>
            <summary>
              {es ? "Ver valores por galería" : "Inspect airway values"}
            </summary>
            <table>
              <thead>
                <tr>
                  <th>{es ? "Galería" : "Airway"}</th>
                  <th>{es ? "Referencia" : "Reference"} (m³/s)</th>
                  <th>{es ? "Predicción" : "Prediction"} (m³/s)</th>
                  <th>Δ (m³/s)</th>
                </tr>
              </thead>
              <tbody>
                {item.network.edges.map((edge, i) => (
                  <tr key={edge.id}>
                    <th scope="row">{edge.name[es ? "es" : "en"]}</th>
                    <td>{metric(fixture.reference.flows[i])}</td>
                    <td>{metric(prediction.result.flows[i])}</td>
                    <td>{metric(prediction.errors[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
      <Callout
        variant="honest"
        title={es ? "Interpretar el resultado" : "Interpret the result"}
      >
        <p>
          {es
            ? "Ejecutar correctamente un modelo no garantiza cierre hidráulico exacto. Los residuos se muestran separadamente. Esta prueba usa soluciones numéricas de escenarios creados; no es validación de terreno ni promesa de aceleración."
            : "Successful model execution does not guarantee exact hydraulic closure. Residuals are shown separately. This test uses numerical solutions on authored scenarios; it is not field validation or a promised speedup."}
        </p>
      </Callout>
    </>
  );
}

export function ConfusionMatrix({ row }: { row: BenchmarkRow }) {
  const es = useShellLang() === "es";
  return (
    <section>
      <h3>
        {es
          ? "Confusión de cumplimiento del objetivo"
          : "Target-status confusion"}
      </h3>
      <p>
        {es
          ? "Filas: estado de referencia. Columnas: predicción. Solo objetivos positivos elegibles; las cantidades y sensibilidades provienen del artefacto."
          : "Rows: reference status. Columns: prediction. Only eligible positive targets; counts and recalls come from the artifact."}
      </p>
      <table>
        <thead>
          <tr>
            <th>{es ? "Referencia / predicción" : "Reference / prediction"}</th>
            <th>{es ? "Déficit predicho" : "Predicted deficit"}</th>
            <th>
              {es ? "Objetivo predicho cumplido" : "Predicted target met"}
            </th>
            <th>{es ? "Sensibilidad de clase" : "Class recall"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              {es ? "Déficit real de referencia" : "Reference deficit"}
            </th>
            <td>{metric(row.shortfallTruePositive, 0)}</td>
            <td>{metric(row.shortfallFalseNegative, 0)}</td>
            <td>
              {row.shortfallRecall === null
                ? es
                  ? "Sin soporte"
                  : "No support"
                : `${metric(row.shortfallRecall * 100, 2)}%`}
            </td>
          </tr>
          <tr>
            <th scope="row">
              {es ? "Objetivo de referencia cumplido" : "Reference target met"}
            </th>
            <td>{metric(row.adequateFalsePositive, 0)}</td>
            <td>{metric(row.adequateTrueNegative, 0)}</td>
            <td>
              {row.adequateRecall === null
                ? es
                  ? "Sin soporte"
                  : "No support"
                : `${metric(row.adequateRecall * 100, 2)}%`}
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        {es
          ? "Observaciones de clasificación:"
          : "Classification observations:"}{" "}
        {metric(row.classificationObservations, 0)}.{" "}
        {es
          ? "No es una clasificación de seguridad ocupacional."
          : "This is not an occupational safety classification."}
      </p>
      <Equation
        tex={String.raw`\operatorname{recall}_c=n_{cc}/\sum_jn_{cj}`}
        caption={
          es
            ? "n_cj cuenta clase de referencia c predicha como j. Sin soporte, la sensibilidad queda indefinida."
            : "n_cj counts reference class c predicted as j. With no class support, recall is undefined."
        }
      />
    </section>
  );
}

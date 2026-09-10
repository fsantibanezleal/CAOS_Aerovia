import { useEffect, useState } from "react";
import {
  Callout,
  Cite,
  Equation,
  InlineMath,
  Refs,
  SubTabs,
  useShellLang,
} from "@fasl-work/caos-app-shell";
import Plot from "../components/Plot";
import MatrixHeatmap from "../content/MatrixHeatmap";
import {
  loadScience,
  type ScienceArtifact,
  type BenchmarkRow,
} from "../learned";
import { useCatalog, type CatalogArtifact } from "../content/artifacts";
import { PageHeading } from "../content/primitives";
import {
  ConfusionMatrix,
  HeldoutLive,
  ReferenceLive,
  metric,
  scientific,
  methodName,
} from "../content/BenchmarkTools";

function EvidenceState({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  const es = useShellLang() === "es";
  return (
    <p role={error ? "alert" : "status"}>
      {loading
        ? es
          ? "Cargando evidencia científica registrada…"
          : "Loading recorded scientific evidence…"
        : es
          ? "La evidencia requerida no está disponible. No se inventan resultados:"
          : "Required evidence is unavailable. No results are inferred:"}{" "}
      {error}
    </p>
  );
}

export default function Benchmark() {
  const es = useShellLang() === "es";
  const catalog = useCatalog();
  const [science, setScience] = useState<ScienceArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    loadScience().then(
      (value) => {
        if (active) setScience(value);
      },
      (reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Scientific evidence unavailable.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const scientificPanel = (
    render: (
      artifact: ScienceArtifact,
      catalog: CatalogArtifact,
    ) => React.ReactNode,
  ) =>
    science && catalog.data ? (
      render(science, catalog.data)
    ) : (
      <EvidenceState
        loading={!error && !catalog.error}
        error={error ?? catalog.error}
      />
    );
  return (
    <div className="page-body prose av-doc-scroll">
      <PageHeading
        title={["Benchmark", "Benchmark"]}
        lede={[
          "Every published number on this page is read from a recorded scientific artifact; live measurements are produced by the controls below. Compare exact numerical agreement, learned held-out errors, degradation and conservation separately. The source networks are authored engineering scenarios, so these results establish computational evidence rather than measured-mine validation.",
          "Cada cifra publicada se lee de un artefacto científico registrado; las mediciones en vivo se producen con los controles. Compare por separado concordancia exacta, errores aprendidos reservados, degradación y conservación. Las redes son escenarios de ingeniería creados: estos resultados son evidencia computacional, no validación medida de mina.",
        ]}
      >
        <InlineMath tex={String.raw`\varepsilon_Q=\widehat Q-Q^*`} />
      </PageHeading>
      <SubTabs
        orientation="vertical"
        ariaLabel={es ? "Evidencia comparativa" : "Comparative evidence"}
        tabs={[
          {
            id: "numerical",
            label: es ? "Referencia en vivo" : "Live reference",
            content: catalog.data ? (
              <>
                <NumericalEvidence catalog={catalog.data} />
                <ReferenceLive catalog={catalog.data} />
              </>
            ) : (
              <EvidenceState loading={catalog.loading} error={catalog.error} />
            ),
          },
          {
            id: "heldout",
            label: es ? "Inferencia reservada" : "Held-out inference",
            content: scientificPanel((artifact, data) => (
              <HeldoutLive science={artifact} catalog={data} />
            )),
          },
          {
            id: "matrix",
            label: es ? "Matriz y errores" : "Matrix and errors",
            content: scientificPanel((artifact, data) => (
              <MatrixEvidence science={artifact} catalog={data} />
            )),
          },
          {
            id: "robustness",
            label: es ? "Degradación" : "Degradation",
            content: scientificPanel((artifact, data) => (
              <RobustnessEvidence science={artifact} catalog={data} />
            )),
          },
          {
            id: "uncertainty",
            label: es ? "Incertidumbre" : "Uncertainty",
            content: catalog.data ? (
              <UncertaintyEvidence catalog={catalog.data} />
            ) : (
              <EvidenceState loading={catalog.loading} error={catalog.error} />
            ),
          },
          {
            id: "provenance",
            label: es ? "Procedencia" : "Provenance",
            content: scientificPanel((artifact, data) => (
              <ProvenanceEvidence science={artifact} catalog={data} />
            )),
          },
        ]}
      />
    </div>
  );
}

function NumericalEvidence({ catalog }: { catalog: CatalogArtifact }) {
  const es = useShellLang() === "es";
  const b = catalog.benchmark;
  return (
    <section>
      <h2>
        {es
          ? "Verificación numérica canónica"
          : "Canonical numerical verification"}
      </h2>
      <p>
        {es
          ? "El registro corresponde a la corrida fechada del catálogo. La referencia SciPy y el lote de resistencias CUDA tienen funciones diferentes; los tiempos no se convierten en una razón de aceleración entre cargas distintas. Cada comparación independiente usa exactamente las mismas resistencias."
          : "The record belongs to the dated catalog execution. SciPy reference and CUDA resistance batches have different roles; their timings are not converted into a speedup ratio between different workloads. Each independent comparison uses exactly the same resistances."}{" "}
        <Cite id="scipytrf" />
      </p>
      <table>
        <thead>
          <tr>
            <th>{es ? "Evidencia registrada" : "Recorded evidence"}</th>
            <th>{es ? "Valor del artefacto" : "Artifact value"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{es ? "Fecha de generación" : "Generated at"}</th>
            <td>{catalog.createdAt}</td>
          </tr>
          <tr>
            <th scope="row">
              {es
                ? "Casos / uniones / galerías"
                : "Cases / junctions / airways"}
            </th>
            <td>
              {b.caseCount} / {b.nodeCount} / {b.edgeCount}
            </td>
          </tr>
          <tr>
            <th scope="row">
              {es
                ? "Residuo máximo de caudal (m³/s)"
                : "Maximum flow residual (m³/s)"}
            </th>
            <td>{scientific(b.maxMassResidual)}</td>
          </tr>
          <tr>
            <th scope="row">
              {es
                ? "Residuo máximo de presión (Pa)"
                : "Maximum pressure residual (Pa)"}
            </th>
            <td>{scientific(b.maxPressureResidual)}</td>
          </tr>
          <tr>
            <th scope="row">
              {es ? "Realizaciones / fallos" : "Realizations / failures"}
            </th>
            <td>
              {metric(b.ensembleSamples, 0)} / {metric(b.ensembleFailures, 0)}
            </td>
          </tr>
          <tr>
            <th scope="row">
              {es ? "Comparaciones independientes" : "Independent comparisons"}
            </th>
            <td>{b.paritySamples}</td>
          </tr>
          <tr>
            <th scope="row">
              {es
                ? "Máx. desacuerdo de caudal (m³/s)"
                : "Maximum flow disagreement (m³/s)"}
            </th>
            <td>{scientific(b.parityMaxAbsFlow)}</td>
          </tr>
          <tr>
            <th scope="row">
              {es ? "Tiempo del lote (ms)" : "Batch time (ms)"}
            </th>
            <td>{metric(b.ensembleElapsedMs, 2)}</td>
          </tr>
          <tr>
            <th scope="row">
              {es ? "Tiempo total registrado (ms)" : "Recorded total time (ms)"}
            </th>
            <td>{metric(b.totalElapsedMs, 2)}</td>
          </tr>
          <tr>
            <th scope="row">
              {es ? "Motor y hardware" : "Backend and hardware"}
            </th>
            <td>
              {b.device} · {b.hardware} · {b.backend}
            </td>
          </tr>
        </tbody>
      </table>
      <Callout
        variant="honest"
        title={
          es
            ? "Verificación, no calibración de mina"
            : "Verification, not mine calibration"
        }
      >
        <p>
          {es
            ? "Los residuos y la concordancia comprueban implementaciones numéricas. Los casos son creados, los objetivos ingresados y la distribución de resistencia supuesta. Ninguna cifra mide precisión frente a una mina observada."
            : "Residuals and agreement check numerical implementations. Cases are authored, targets supplied and the resistance distribution assumed. None of these values measures accuracy against an observed mine."}
        </p>
      </Callout>
      <Refs
        ids={["scipytrf", "pytorchsolve", "numpylognormal"]}
        label={es ? "Referencias" : "References"}
      />
    </section>
  );
}

function MetricsTable({
  rows,
  es,
  caseName,
}: {
  rows: BenchmarkRow[];
  es: boolean;
  caseName?: (id: string) => string;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>{es ? "Método" : "Method"}</th>
          {caseName && <th>{es ? "Caso / régimen" : "Case / regime"}</th>}
          <th>{es ? "Muestras" : "Samples"}</th>
          <th>MAE Q (m³/s)</th>
          <th>RMSE Q (m³/s)</th>
          <th>NRMSE Q</th>
          <th>{es ? "MAE Q crudo" : "Raw Q MAE"} (m³/s)</th>
          <th>{es ? "Máx. Q" : "Max Q"} (m³/s)</th>
          <th>MAE p (Pa)</th>
          <th>{es ? "Residuo p" : "p residual"} (Pa)</th>
          <th>{es ? "Desequilibrio nodal" : "Nodal imbalance"} (m³/s)</th>
          <th>{es ? "Potencia MAE" : "Power MAE"} (kW)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.methodId}-${row.networkId}-${row.regimeId}-${index}`}>
            <th scope="row">{methodName(row.methodId, es)}</th>
            {caseName && (
              <td>
                {caseName(row.networkId ?? "")} · {row.regimeId}
              </td>
            )}
            <td>{metric(row.samples, 0)}</td>
            <td>{metric(row.flowMAE)}</td>
            <td>{metric(row.flowRMSE)}</td>
            <td>{metric(row.flowNormalizedRMSE, 6)}</td>
            <td>{metric(row.rawFlowMAE)}</td>
            <td>{metric(row.flowMaxError)}</td>
            <td>{metric(row.pressureMAE, 2)}</td>
            <td>{scientific(row.pressureResidualMax)}</td>
            <td>{scientific(row.massResidualMax)}</td>
            <td>{metric(row.powerMAE)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MatrixEvidence({
  science,
  catalog,
}: {
  science: ScienceArtifact;
  catalog: CatalogArtifact;
}) {
  const es = useShellLang() === "es";
  const [method, setMethod] = useState("topology-mlp");
  const [network, setNetwork] = useState("all");
  const [regime, setRegime] = useState("all");
  const [split, setSplit] = useState("all");
  const b = science.benchmark;
  const row = b.aggregate.find((r) => r.methodId === method);
  const name = (id: string) =>
    catalog.cases.find((c) => c.network.id === id)?.network.name[
      es ? "es" : "en"
    ] ?? id;
  const selected = b.rows.filter(
    (r) =>
      r.methodId === method &&
      (network === "all" || r.networkId === network) &&
      (regime === "all" || r.regimeId === regime) &&
      (split === "all" || r.split === split),
  );
  const counts = selected.reduce(
    (sum, r) => ({
      shortfallTruePositive:
        sum.shortfallTruePositive + r.shortfallTruePositive,
      shortfallFalseNegative:
        sum.shortfallFalseNegative + r.shortfallFalseNegative,
      adequateTrueNegative: sum.adequateTrueNegative + r.adequateTrueNegative,
      adequateFalsePositive:
        sum.adequateFalsePositive + r.adequateFalsePositive,
      classificationObservations:
        sum.classificationObservations + r.classificationObservations,
    }),
    {
      shortfallTruePositive: 0,
      shortfallFalseNegative: 0,
      adequateTrueNegative: 0,
      adequateFalsePositive: 0,
      classificationObservations: 0,
    },
  );
  const confusion =
    row && selected.length
      ? {
          ...row,
          ...counts,
          shortfallRecall:
            counts.shortfallTruePositive + counts.shortfallFalseNegative
              ? counts.shortfallTruePositive /
                (counts.shortfallTruePositive + counts.shortfallFalseNegative)
              : null,
          adequateRecall:
            counts.adequateTrueNegative + counts.adequateFalsePositive
              ? counts.adequateTrueNegative /
                (counts.adequateTrueNegative + counts.adequateFalsePositive)
              : null,
        }
      : null;
  return (
    <section>
      <h2>
        {es
          ? "Comparación completa sobre entradas iguales"
          : "Complete comparison on identical inputs"}
      </h2>
      <p>
        {es
          ? "Las filas agregadas se calculan sobre la matriz registrada. Se muestran caudal, presión y potencia en sus unidades, junto con el residuo físico. Los modelos aproximados no se aceptan como solucionadores exactos por producir arreglos finitos. Use los filtros para inspeccionar casos y regímenes que un promedio puede ocultar."
          : "Aggregate rows are computed over the recorded matrix. Flow, pressure and power retain their units, alongside physical residuals. Approximate models are not accepted as exact solvers merely because they return finite arrays. Filter cases and regimes to inspect behavior an average can hide."}{" "}
        <Cite id="sklearnmetrics" />
      </p>
      <p>
        {es ? "Cobertura registrada:" : "Recorded coverage:"}{" "}
        {b.completeness.actualCells} / {b.completeness.expectedCells}{" "}
        {es ? "celdas; faltantes:" : "cells; missing:"}{" "}
        {b.completeness.missingCells}. {b.completeness.cases}{" "}
        {es ? "casos" : "cases"} × {b.completeness.regimes}{" "}
        {es ? "regímenes" : "regimes"} × {b.completeness.methods}{" "}
        {es ? "métodos" : "methods"}.
      </p>
      <MetricsTable rows={b.aggregate} es={es} />
      <p>
        {es
          ? "NRMSE divide cada error por el máximo entre el caudal absoluto de referencia y 5 m³/s antes de calcular la raíz de su media cuadrática; es adimensional y conserva ramas casi estancadas. MAE crudo precede la proyección de conservación. El desequilibrio nodal y residuo de presión usan las ecuaciones originales."
          : "NRMSE divides each error by the maximum of absolute reference flow and 5 m³/s before computing its root mean square; it is dimensionless and retains near-stagnant branches. Raw MAE precedes the conservation projection. Nodal imbalance and pressure residual use the original equations."}
      </p>
      <h3>
        {es
          ? "Inspeccionar celdas del experimento"
          : "Inspect experiment cells"}
      </h3>
      <label>
        {es ? "Método" : "Method"}{" "}
        <select
          aria-label={es ? "Método" : "Method"}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {b.aggregate.map((r) => (
            <option key={r.methodId} value={r.methodId}>
              {methodName(r.methodId, es)}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        {es ? "Caso" : "Case"}{" "}
        <select
          aria-label={es ? "Caso" : "Case"}
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
        >
          <option value="all">{es ? "Todos" : "All"}</option>
          {catalog.cases.map((c) => (
            <option key={c.network.id} value={c.network.id}>
              {c.network.name[es ? "es" : "en"]}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        {es ? "Régimen" : "Regime"}{" "}
        <select
          aria-label={es ? "Régimen" : "Regime"}
          value={regime}
          onChange={(e) => setRegime(e.target.value)}
        >
          <option value="all">{es ? "Todos" : "All"}</option>
          {science.regimes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name[es ? "es" : "en"]}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        {es ? "Partición" : "Partition"}{" "}
        <select
          aria-label={es ? "Partición" : "Partition"}
          value={split}
          onChange={(e) => setSplit(e.target.value)}
        >
          <option value="all">{es ? "Todas" : "All"}</option>
          {[...new Set(b.rows.map((r) => r.split).filter(Boolean))].map((s) => (
            <option key={s} value={s}>
              {s === "test"
                ? es
                  ? "Prueba reservada"
                  : "Held-out test"
                : s === "replay"
                  ? es
                    ? "Regímenes exactos"
                    : "Exact regimes"
                  : s}
            </option>
          ))}
        </select>
      </label>
      <MatrixHeatmap
        science={science}
        catalog={catalog}
        methodId={method}
        selectedCase={network}
        selectedRegime={regime}
        onSelect={(caseId, regimeId) => {
          setNetwork(caseId);
          setRegime(regimeId);
          setSplit("test");
        }}
      />
      <p>
        {es ? "Filas seleccionadas:" : "Selected rows:"} {selected.length}.{" "}
        {es
          ? "Todas usan escenarios creados y etiquetas numéricas; no datos medidos de mina."
          : "All use authored scenarios and numerical labels; no measured mine data."}
      </p>
      <MetricsTable rows={selected} es={es} caseName={name} />
      {confusion && <ConfusionMatrix row={confusion} />}
      <Equation
        tex={String.raw`\operatorname{MAE}=\operatorname{mean}|\widehat Q-Q^*|,\quad\operatorname{RMSE}=\sqrt{\operatorname{mean}(\widehat Q-Q^*)^2}`}
        caption={
          es
            ? "Q̂ es predicción, Q* referencia; MAE y RMSE conservan m³/s. La matriz declara partición y soporte."
            : "Q̂ is prediction, Q* reference; MAE and RMSE retain m³/s. The matrix declares partition and support."
        }
      />
      <Refs
        ids={["sklearnmetrics", "sklearnleakage"]}
        label={es ? "Referencias" : "References"}
      />
    </section>
  );
}

function RobustnessEvidence({
  science,
  catalog,
}: {
  science: ScienceArtifact;
  catalog: CatalogArtifact;
}) {
  const es = useShellLang() === "es";
  const [quantity, setQuantity] = useState<
    "flowMAE" | "flowRMSE" | "pressureMAE"
  >("flowMAE");
  const rows = science.benchmark.degradation;
  const holdout = science.benchmark.familyHoldout;
  const labels = {
    flowMAE: es ? "MAE de caudal" : "Flow MAE",
    flowRMSE: es ? "RMSE de caudal" : "Flow RMSE",
    pressureMAE: es ? "MAE de presión" : "Pressure MAE",
  };
  return (
    <section>
      <h2>
        {es
          ? "Degradación bajo error sintético de resistencia"
          : "Degradation under synthetic resistance input error"}
      </h2>
      <p>
        {es
          ? "Se perturba la resistencia observada con ruido multiplicativo lognormal de media uno y se mantiene fija la referencia verdadera del caso reservado. Ambos modelos reciben las mismas perturbaciones. Esto mide sensibilidad a errores sintéticos de entrada, no precisión real de sensores. El experimento local conserva entradas fuera del dominio y cuenta cuántas son; no las recorta para mejorar la curva."
          : "Observed resistance is perturbed by mean-one multiplicative lognormal noise while the held-out true reference remains fixed. Both models receive the same perturbations. This measures sensitivity to synthetic input errors, not actual sensor accuracy. The offline experiment retains and counts out-of-domain inputs; it does not clip them to improve the curve."}{" "}
        <Cite id="numpylognormal" />
      </p>
      <Equation
        tex={String.raw`R_{\mathrm{observed}}=R_{\mathrm{true}}\exp(\sigma Z-\sigma^2/2),\quad Z\sim\mathcal N(0,1)`}
        caption={
          es
            ? "σ es intensidad logarítmica del ruido, Z normal estándar. Referencia corresponde a R_true; modelos reciben R_observed."
            : "σ is logarithmic noise strength, Z a standard normal. The reference corresponds to R_true; models receive R_observed."
        }
      />
      {rows?.length ? (
        <>
          <label>
            {es ? "Error a comparar" : "Compare error"}{" "}
            <select
              aria-label={es ? "Error a comparar" : "Compare error"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value as typeof quantity)}
            >
              {Object.entries(labels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Plot
            title={labels[quantity]}
            xlabel={es ? "σ de error logarítmico" : "Log-input error σ"}
            ylabel={quantity === "pressureMAE" ? "Pa" : "m³/s"}
            series={(["topology-mlp", "graph-surrogate"] as const).map(
              (method, i) => ({
                label: methodName(method, es),
                color: i ? "var(--color-warn)" : "var(--color-accent)",
                values: rows
                  .filter((r) => r.methodId === method)
                  .sort((a, b) => a.noiseSigma - b.noiseSigma)
                  .map((r) => ({ x: r.noiseSigma, y: r[quantity] })),
              }),
            )}
          />
          <table>
            <thead>
              <tr>
                <th>{es ? "Método" : "Method"}</th>
                <th>σ</th>
                <th>{es ? "Muestras" : "Samples"}</th>
                <th>{labels[quantity]}</th>
                <th>{es ? "Fuera del dominio" : "Outside domain"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.methodId}-${r.noiseSigma}`}>
                  <th scope="row">{methodName(r.methodId, es)}</th>
                  <td>{r.noiseSigma}</td>
                  <td>{r.samples}</td>
                  <td>{metric(r[quantity])}</td>
                  <td>{r.outsideDomain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p role="alert">
          {es
            ? "No hay curva de degradación registrada; la evidencia está incompleta."
            : "No recorded degradation curve is available; evidence is incomplete."}
        </p>
      )}
      <h3>
        {es ? "Familia topológica reservada" : "Held-out topology family"}
      </h3>
      {holdout ? (
        <>
          <p>
            {es
              ? "Un modelo de grafo separado excluye por completo la familia indicada del entrenamiento y validación de perturbaciones. Recibe la calibración nominal declarada del grafo nuevo, sin sus etiquetas perturbadas. Este experimento no habilita inferencia en vivo sobre grafos arbitrarios."
              : "A separate graph model excludes the indicated family entirely from perturbation training and validation. It receives the disclosed nominal calibration of the new graph without its perturbed labels. This experiment does not enable live inference on arbitrary graphs."}
          </p>
          <p>
            {es ? "Familia reservada:" : "Held-out family:"} {holdout.family}.{" "}
            {es ? "Casos excluidos:" : "Excluded cases:"}{" "}
            {holdout.excludedCaseIds.join(", ")}.
          </p>
          <p>
            {es
              ? "Presupuesto de entrenamiento del experimento:"
              : "Diagnostic training budget:"}{" "}
            {holdout.training.epochs}{" "}
            {es
              ? "épocas; checkpoint elegido:"
              : "epochs; selected checkpoint:"}{" "}
            {holdout.training.bestEpoch}.{" "}
            {es
              ? "Presupuesto del grafo principal:"
              : "Production graph budget:"}{" "}
            {
              science.training.models.find(
                (model) => model.methodId === "graph-surrogate",
              )?.epochs
            }{" "}
            {es
              ? "épocas. La comparación de exactitud no aísla causalmente el cambio de topología porque el presupuesto también difiere."
              : "epochs. The accuracy comparison does not causally isolate topology change because the training budget also differs."}
          </p>
          <MetricsTable rows={[holdout.aggregate]} es={es} />
          <ConfusionMatrix row={holdout.aggregate} />
          <details>
            <summary>
              {es
                ? "Inspeccionar transferencia por régimen"
                : "Inspect transfer by regime"}
            </summary>
            <MetricsTable
              rows={holdout.metrics}
              es={es}
              caseName={(id) =>
                catalog.cases.find((c) => c.network.id === id)?.network.name[
                  es ? "es" : "en"
                ] ?? id
              }
            />
          </details>
        </>
      ) : (
        <p role="status">
          {es
            ? "No hay evidencia registrada de transferencia de familia; no se infiere generalización."
            : "No recorded family-transfer evidence is available; no generalization is inferred."}
        </p>
      )}
      <h3>
        {es
          ? "Cobertura real del límite de error calibrado"
          : "Actual coverage of the calibrated error bound"}
      </h3>
      <p>
        {es
          ? "El límite se selecciona con la partición de calibración y se evalúa una vez en prueba reservada. La cobertura nominal es un objetivo de calibración; la observada puede ser menor. El límite de caudal se expresa a velocidad unitaria y no constituye garantía física ni intervalo calibrado sobre una mina medida."
          : "The bound is selected using the calibration partition and evaluated once on held-out test data. Nominal coverage is a calibration target; observed coverage can be lower. The flow bound is expressed at unit speed and is neither a physical guarantee nor an interval calibrated on a measured mine."}
      </p>
      <table>
        <thead>
          <tr>
            <th>{es ? "Método / caso" : "Method / case"}</th>
            <th>{es ? "Límite Q (m³/s)" : "Q bound (m³/s)"}</th>
            <th>{es ? "Cobertura nominal" : "Nominal coverage"}</th>
            <th>{es ? "Cobertura reservada" : "Held-out coverage"}</th>
            <th>{es ? "Cubiertas / prueba" : "Covered / test"}</th>
          </tr>
        </thead>
        <tbody>
          {science.benchmark.calibration.map((row) => (
            <tr key={`${row.methodId}-${row.networkId}`}>
              <th scope="row">
                {methodName(row.methodId, es)} ·{" "}
                {catalog.cases.find((c) => c.network.id === row.networkId)
                  ?.network.name[es ? "es" : "en"] ?? row.networkId}
              </th>
              <td>{metric(row.flowMaxErrorBoundUnitSpeed)}</td>
              <td>{metric(row.nominalCoverage * 100, 2)}%</td>
              <td>{metric(row.heldoutCoverage * 100, 2)}%</td>
              <td>
                {row.heldoutCovered} / {row.heldoutSamples}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Callout
        variant="honest"
        title={es ? "Límite de interpretación" : "Interpretation boundary"}
      >
        <p>
          {es
            ? "El ruido es sintético, los datos son creados y la familia reservada continúa siendo geometría generada. Una curva honesta conserva degradación y fallos; no equivale a validación entre minas reales."
            : "Noise is synthetic, data are authored and the held-out family remains generated geometry. An honest curve retains degradation and failures; it is not validation across real mines."}
        </p>
      </Callout>
      <Refs
        ids={["numpylognormal", "sklearnleakage", "gilmer2017"]}
        label={es ? "Referencias" : "References"}
      />
    </section>
  );
}

function UncertaintyEvidence({ catalog }: { catalog: CatalogArtifact }) {
  const es = useShellLang() === "es";
  const [selected, setSelected] = useState(catalog.cases[0].network.id);
  const item = catalog.cases.find((c) => c.network.id === selected)!;
  const e = item.ensemble;
  return (
    <section>
      <h2>
        {es
          ? "Intervalos condicionales de caudal"
          : "Conditional flow intervals"}
      </h2>
      <p>
        {es
          ? "Cada curva se lee del conjunto registrado para las opciones nominales exactas de su caso. Seleccionar otro caso carga sus propios cuantiles; editar un proyecto en la herramienta no recalcula estas bandas. Las realizaciones suponen resistencias independientes lognormales, con coeficiente de variación y semilla registrados."
          : "Each curve is read from the recorded ensemble for the case’s exact nominal options. Selecting another case loads its own quantiles; editing a project in the workbench does not recompute these bands. Draws assume independent lognormal resistances with recorded coefficient of variation and seed."}{" "}
        <Cite id="numpylognormal" />
      </p>
      <label>
        {es ? "Caso del conjunto" : "Ensemble case"}{" "}
        <select
          aria-label={es ? "Caso del conjunto" : "Ensemble case"}
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
      <p>
        {es
          ? "Muestras aceptadas / solicitadas:"
          : "Accepted / requested samples:"}{" "}
        {e.acceptedSamples} / {e.samples} · CV {metric(e.cv)} ·{" "}
        {es ? "semilla" : "seed"} {e.seed} · {e.device}
      </p>
      <Plot
        title={es ? "Cuantiles por galería" : "Quantiles by airway"}
        xlabel={es ? "Índice de galería" : "Airway index"}
        ylabel="m³/s"
        series={[
          {
            label: "p05",
            color: "var(--color-fg-subtle)",
            values: e.flowP05.map((y, x) => ({ x: x + 1, y })),
          },
          {
            label: "p50",
            color: "var(--color-accent)",
            values: e.flowP50.map((y, x) => ({ x: x + 1, y })),
          },
          {
            label: "p95",
            color: "var(--color-warn)",
            values: e.flowP95.map((y, x) => ({ x: x + 1, y })),
          },
        ]}
      />
      <details>
        <summary>
          {es
            ? "Leer cuantiles y objetivos por galería"
            : "Read airway quantiles and targets"}
        </summary>
        <table>
          <thead>
            <tr>
              <th>{es ? "Galería" : "Airway"}</th>
              <th>p05</th>
              <th>p50</th>
              <th>p95</th>
              <th>{es ? "Objetivo" : "Target"} (m³/s)</th>
            </tr>
          </thead>
          <tbody>
            {item.network.edges.map((edge, i) => (
              <tr key={edge.id}>
                <th scope="row">{edge.name[es ? "es" : "en"]}</th>
                <td>{metric(e.flowP05[i])}</td>
                <td>{metric(e.flowP50[i])}</td>
                <td>{metric(e.flowP95[i])}</td>
                <td>
                  {metric(
                    item.options.overrides[edge.id]?.target ?? edge.target,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <Equation
        tex={String.raw`R^{(j)}=R\exp(\sigma Z^{(j)}-\sigma^2/2),\quad\sigma=\sqrt{\log(1+\mathrm{CV}^2)}`}
        caption={
          es
            ? "R es resistencia nominal, Z normal estándar y CV dispersión aritmética. El multiplicador tiene media uno."
            : "R is nominal resistance, Z standard normal and CV arithmetic spread. The multiplier has mean one."
        }
      />
      <Callout
        variant="honest"
        title={es ? "Intervalo condicional" : "Conditional interval"}
      >
        <p>
          {es
            ? "Estos cuantiles no están ajustados a observaciones de mina. Independencia, distribución y parámetros son supuestos; la banda no es garantía de seguridad ni incertidumbre de un proyecto editado."
            : "These quantiles are not fitted to mine observations. Independence, distribution and parameters are assumptions; the band is neither a safety guarantee nor uncertainty for an edited project."}
        </p>
      </Callout>
      <Refs
        ids={["numpylognormal", "pytorchsolve", "scipytrf"]}
        label={es ? "Referencias" : "References"}
      />
    </section>
  );
}

function ProvenanceEvidence({
  science,
  catalog,
}: {
  science: ScienceArtifact;
  catalog: CatalogArtifact;
}) {
  const es = useShellLang() === "es";
  const t = science.training;
  return (
    <section>
      <h2>
        {es
          ? "Ejecuciones, datos y procedencia"
          : "Executions, data and provenance"}
      </h2>
      <p>
        {es
          ? "Los recuentos, tiempos y equipos siguientes provienen del artefacto científico. No se infiere entrenamiento por la presencia de un archivo de modelo. Calibración nominal, particiones, registros y comparaciones de exportación definen exactamente qué se ejecutó y sobre qué entradas."
          : "Counts, timings and devices below come from the scientific artifact. Training is not inferred from the presence of a model file. Nominal calibration, partitions, registries and export comparisons define exactly what ran and on which inputs."}{" "}
        <Cite id="sklearnleakage" />
      </p>
      <table>
        <tbody>
          <tr>
            <th scope="row">
              {es
                ? "Creación del artefacto científico"
                : "Scientific artifact creation"}
            </th>
            <td>{science.createdAt}</td>
          </tr>
          <tr>
            <th scope="row">
              {es ? "Versión del artefacto" : "Artifact version"}
            </th>
            <td>{science.version}</td>
          </tr>
          <tr>
            <th scope="row">{es ? "Tipo de fuente" : "Source kind"}</th>
            <td>
              {es
                ? "Redes creadas; etiquetas de solución numérica"
                : "Authored networks; numerical-solution labels"}
            </td>
          </tr>
          <tr>
            <th scope="row">
              {es ? "Observaciones de terreno" : "Field observations"}
            </th>
            <td>
              {science.provenance.noFieldMeasurements
                ? es
                  ? "No incluidas"
                  : "Not included"
                : es
                  ? "Revisar procedencia de origen"
                  : "Review source provenance"}
            </td>
          </tr>
          <tr>
            <th scope="row">
              {es ? "Licencia del conjunto" : "Dataset license"}
            </th>
            <td>{science.provenance.license}</td>
          </tr>
          <tr>
            <th scope="row">
              {es
                ? "Muestras totales / vectores únicos / duplicados"
                : "Total samples / unique vectors / duplicates"}
            </th>
            <td>
              {metric(t.totalSamples, 0)} / {metric(t.uniqueInputVectors, 0)} /{" "}
              {metric(t.duplicateInputs, 0)}
            </td>
          </tr>
          <tr>
            <th scope="row">
              {es
                ? "Tiempo de generación de datos (s)"
                : "Dataset generation time (s)"}
            </th>
            <td>{metric(t.datasetSeconds, 2)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        {es
          ? "Archivos públicos inspeccionables:"
          : "Inspectable public artifacts:"}{" "}
        <a href={`${import.meta.env.BASE_URL}data/science.json`} download>
          science.json
        </a>{" "}
        ·{" "}
        <a href={`${import.meta.env.BASE_URL}data/catalog.json`} download>
          catalog.json
        </a>{" "}
        ·{" "}
        <a
          href={`${import.meta.env.BASE_URL}data/models/registry.json`}
          download
        >
          registry.json
        </a>{" "}
        ·{" "}
        <a
          href={`${import.meta.env.BASE_URL}data/models/browser-evidence.json`}
          download
        >
          {es ? "Concordancia real de navegador" : "Actual browser parity"}
        </a>
        .
      </p>
      <p className="av-source-hash">
        SHA-256: <code>{science.sourceSha256}</code>
      </p>
      <h3>{es ? "Particiones registradas" : "Recorded partitions"}</h3>
      <table>
        <thead>
          <tr>
            <th>{es ? "Partición" : "Partition"}</th>
            <th>{es ? "Muestras" : "Samples"}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(t.splits).map(([key, count]) => (
            <tr key={key}>
              <th scope="row">
                {key === "train"
                  ? es
                    ? "Entrenamiento"
                    : "Training"
                  : key === "validation"
                    ? es
                      ? "Validación"
                      : "Validation"
                    : key === "calibration"
                      ? es
                        ? "Calibración"
                        : "Calibration"
                      : key === "test"
                        ? es
                          ? "Prueba reservada"
                          : "Held-out test"
                        : key}
              </th>
              <td>{metric(count, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>
        {es ? "Corridas reales de entrenamiento" : "Actual training runs"}
      </h3>
      <table>
        <thead>
          <tr>
            <th>{es ? "Método" : "Method"}</th>
            <th>{es ? "Casos" : "Cases"}</th>
            <th>{es ? "Parámetros" : "Parameters"}</th>
            <th>
              {es ? "Época elegida / ejecutadas" : "Selected / executed epochs"}
            </th>
            <th>{es ? "Tiempo (s)" : "Time (s)"}</th>
            <th>{es ? "Dispositivo" : "Device"}</th>
          </tr>
        </thead>
        <tbody>
          {t.models.map((model, i) => (
            <tr key={`${model.methodId}-${i}`}>
              <th scope="row">{methodName(model.methodId, es)}</th>
              <td>
                {model.caseIds
                  .map(
                    (id) =>
                      catalog.cases.find((c) => c.network.id === id)?.network
                        .name[es ? "es" : "en"] ?? id,
                  )
                  .join(", ")}
              </td>
              <td>{metric(model.parameters, 0)}</td>
              <td>
                {model.bestEpoch} / {model.epochs}
              </td>
              <td>{metric(model.elapsedSeconds, 2)}</td>
              <td>
                {model.runtime.device} · {model.runtime.hardware} ·{" "}
                {model.runtime.torch}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>
        {es
          ? "Comprobación independiente de etiquetas"
          : "Independent label checks"}
      </h3>
      <table>
        <thead>
          <tr>
            <th>{es ? "Caso" : "Case"}</th>
            <th>{es ? "Muestras SciPy" : "SciPy samples"}</th>
            <th>{es ? "Máx. diferencia Q" : "Maximum Q difference"} (m³/s)</th>
            <th>{es ? "Máx. diferencia p" : "Maximum p difference"} (Pa)</th>
          </tr>
        </thead>
        <tbody>
          {science.benchmark.teacherParity.map((row) => (
            <tr key={row.networkId}>
              <th scope="row">
                {catalog.cases.find((c) => c.network.id === row.networkId)
                  ?.network.name[es ? "es" : "en"] ?? row.networkId}
              </th>
              <td>{row.samples}</td>
              <td>{scientific(row.flowMaxAbs)}</td>
              <td>{scientific(row.pressureMaxAbs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Callout
        variant="honest"
        title={es ? "Alcance de procedencia" : "Provenance scope"}
      >
        <p>
          {es
            ? "Los métodos usan una solución nominal de calibración declarada. Aprender del simulador no equivale a entrenar sobre mediciones de mina. Los tiempos CUDA, CPU y navegador pertenecen a operaciones diferentes y no se combinan en una promesa de aceleración."
            : "Methods use a disclosed nominal calibration solution. Learning from the simulator is not training on mine measurements. CUDA, CPU and browser timings belong to different operations and are not combined into a speedup promise."}
        </p>
      </Callout>
      <Refs
        ids={["sklearnleakage", "pytorchsolve", "onnxweb"]}
        label={es ? "Referencias" : "References"}
      />
    </section>
  );
}

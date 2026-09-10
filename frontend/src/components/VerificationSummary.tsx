interface Benchmark {
  caseCount: number;
  nodeCount: number;
  edgeCount: number;
  maxMassResidual: number;
  maxPressureResidual: number;
  ensembleSamples: number;
  samplesPerCase: number;
  ensembleFailures: number;
  paritySamples: number;
  parityMaxAbsFlow: number;
  referenceElapsedMs: number;
  ensembleElapsedMs: number;
  totalElapsedMs: number;
  device: "cuda" | "cpu";
  hardware: string;
  backend: string;
}

/** Validate the supplied record before turning it into numerical evidence cards. */
export function readBenchmark(
  input: unknown,
  expectedCases: number,
): Benchmark | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  const counts = [
    "caseCount",
    "nodeCount",
    "edgeCount",
    "ensembleSamples",
    "samplesPerCase",
    "ensembleFailures",
    "paritySamples",
  ] as const;
  const values = [
    "maxMassResidual",
    "maxPressureResidual",
    "parityMaxAbsFlow",
    "referenceElapsedMs",
    "ensembleElapsedMs",
    "totalElapsedMs",
  ] as const;
  for (const key of counts)
    if (
      typeof data[key] !== "number" ||
      !Number.isSafeInteger(data[key]) ||
      data[key] < 0
    )
      return null;
  for (const key of values)
    if (
      typeof data[key] !== "number" ||
      !Number.isFinite(data[key]) ||
      data[key] < 0
    )
      return null;
  if (data.caseCount !== expectedCases || expectedCases < 1) return null;
  if (
    (data.nodeCount as number) < expectedCases * 2 ||
    (data.edgeCount as number) < expectedCases
  )
    return null;
  if (
    (data.samplesPerCase as number) < 1 ||
    data.ensembleSamples !== (data.samplesPerCase as number) * expectedCases
  )
    return null;
  if (
    (data.ensembleFailures as number) > (data.ensembleSamples as number) ||
    (data.paritySamples as number) < 1 ||
    (data.paritySamples as number) > (data.ensembleSamples as number)
  )
    return null;
  if (data.device !== "cuda" && data.device !== "cpu") return null;
  for (const key of ["hardware", "backend"])
    if (
      typeof data[key] !== "string" ||
      !data[key].trim() ||
      data[key].length > 300
    )
      return null;
  return Object.fromEntries(
    [...counts, ...values, "device", "hardware", "backend"].map((key) => [
      key,
      data[key],
    ]),
  ) as unknown as Benchmark;
}

export default function VerificationSummary({
  benchmark,
  caseCount,
  lang,
}: {
  benchmark: unknown;
  caseCount: number;
  lang: "en" | "es";
}) {
  const b = (en: string, es: string) => (lang === "en" ? en : es);
  const record = readBenchmark(benchmark, caseCount);
  if (!record)
    return (
      <p role="status">
        {b(
          "The verification record is missing required metrics or does not match this case library. No validation statistics are inferred.",
          "El registro de verificación carece de métricas requeridas o no coincide con esta biblioteca. No se infieren estadísticas de validación.",
        )}
      </p>
    );
  const count = (value: number) =>
    value.toLocaleString(lang === "en" ? "en-US" : "es-CL");
  const scientific = (value: number) => value.toExponential(2);
  const passed =
    record.maxMassResidual <= 1e-6 &&
    record.maxPressureResidual <= 1e-5 &&
    record.parityMaxAbsFlow <= 2e-6 &&
    record.ensembleFailures === 0;
  return (
    <>
      <p>
        <strong>
          {passed
            ? b(
                "Recorded equation and agreement checks pass.",
                "Las comprobaciones registradas de ecuaciones y concordancia pasan.",
              )
            : b(
                "The recorded checks contain failures or exceed a tolerance.",
                "Las comprobaciones registradas contienen fallos o superan una tolerancia.",
              )}
        </strong>
      </p>
      <div className="analysis-grid">
        <section className="analysis-card">
          <h3>{b("Network conservation", "Conservación en la red")}</h3>
          <div className="cost-line">
            <span>{b("Authored cases solved", "Casos creados resueltos")}</span>
            <strong>{count(record.caseCount)}</strong>
          </div>
          <div className="cost-line">
            <span>
              {b(
                "Junctions / airways across cases",
                "Uniones / galerías entre casos",
              )}
            </span>
            <strong>
              {count(record.nodeCount)} / {count(record.edgeCount)}
            </strong>
          </div>
          <div className="cost-line">
            <span>
              {b("Maximum mass imbalance", "Desequilibrio máximo de caudal")}
            </span>
            <strong>{scientific(record.maxMassResidual)} m³/s</strong>
          </div>
          <div className="cost-line">
            <span>
              {b("Maximum pressure error", "Error máximo de presión")}
            </span>
            <strong>{scientific(record.maxPressureResidual)} Pa</strong>
          </div>
          <p>
            {b(
              "Absolute acceptance limits: 1e-6 m³/s and 1e-5 Pa.",
              "Límites absolutos de aceptación: 1e-6 m³/s y 1e-5 Pa.",
            )}
          </p>
        </section>
        <section className="analysis-card">
          <h3>{b("Resistance ensemble", "Conjunto de resistencias")}</h3>
          <div className="cost-line">
            <span>
              {b(
                "Computed resistance draws",
                "Realizaciones de resistencia calculadas",
              )}
            </span>
            <strong>{count(record.ensembleSamples)}</strong>
          </div>
          <div className="cost-line">
            <span>
              {b("Draws per authored case", "Realizaciones por caso creado")}
            </span>
            <strong>{count(record.samplesPerCase)}</strong>
          </div>
          <div className="cost-line">
            <span>
              {b(
                "Rejected numerical draws",
                "Realizaciones numéricas rechazadas",
              )}
            </span>
            <strong>{count(record.ensembleFailures)}</strong>
          </div>
          <p>
            {b("Recorded execution device", "Dispositivo registrado")}:{" "}
            <strong>{record.device === "cuda" ? "CUDA" : "CPU"}</strong>
          </p>
        </section>
        <section className="analysis-card">
          <h3>
            {b(
              "Independent batch agreement",
              "Concordancia independiente del lote",
            )}
          </h3>
          <div className="cost-line">
            <span>
              {b(
                "Draws checked against SciPy",
                "Realizaciones contrastadas con SciPy",
              )}
            </span>
            <strong>{count(record.paritySamples)}</strong>
          </div>
          <div className="cost-line">
            <span>
              {b(
                "Maximum branch-flow difference",
                "Diferencia máxima de caudal por rama",
              )}
            </span>
            <strong>{scientific(record.parityMaxAbsFlow)} m³/s</strong>
          </div>
          <p>
            {b(
              "The batch result is compared with the separately solved SciPy reference on the same resistance inputs. Agreement tolerance: 2e-6 m³/s.",
              "El resultado del lote se compara con la solución independiente de SciPy con las mismas resistencias. Tolerancia de concordancia: 2e-6 m³/s.",
            )}
          </p>
        </section>
        <section className="analysis-card">
          <h3>
            {b(
              "Recorded processing time",
              "Tiempo de procesamiento registrado",
            )}
          </h3>
          <div className="cost-line">
            <span>{b("Canonical SciPy solve", "Solución canónica SciPy")}</span>
            <strong>{record.referenceElapsedMs.toFixed(1)} ms</strong>
          </div>
          <div className="cost-line">
            <span>{b("Resistance ensemble", "Conjunto de resistencias")}</span>
            <strong>{(record.ensembleElapsedMs / 1000).toFixed(2)} s</strong>
          </div>
          <div className="cost-line">
            <span>
              {b("Whole recorded pipeline", "Cadena registrada completa")}
            </span>
            <strong>{(record.totalElapsedMs / 1000).toFixed(2)} s</strong>
          </div>
          <p>
            {record.hardware}
            <br />
            {record.backend}
          </p>
        </section>
      </div>
    </>
  );
}

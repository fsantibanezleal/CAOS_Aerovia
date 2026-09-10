import { useState } from "react";
import { useShellLang } from "@fasl-work/caos-app-shell";
import type { BenchmarkRow, ScienceArtifact } from "../learned";
import type { CatalogArtifact } from "./artifacts";
import { metric, methodName } from "./BenchmarkTools";

type Quantity = "flowMAE" | "flowRMSE" | "pressureMAE" | "pressureResidualMax";

/** One recorded test cell per network/regime; values are never interpolated. */
export default function MatrixHeatmap({
  science,
  catalog,
  methodId,
  selectedCase,
  selectedRegime,
  onSelect,
}: {
  science: ScienceArtifact;
  catalog: CatalogArtifact;
  methodId: string;
  selectedCase: string;
  selectedRegime: string;
  onSelect: (networkId: string, regimeId: string) => void;
}) {
  const es = useShellLang() === "es";
  const [quantity, setQuantity] = useState<Quantity>("flowMAE");
  const labels: Record<Quantity, string> = {
    flowMAE: es ? "MAE de caudal (m³/s)" : "Flow MAE (m³/s)",
    flowRMSE: es ? "RMSE de caudal (m³/s)" : "Flow RMSE (m³/s)",
    pressureMAE: es ? "MAE de presión (Pa)" : "Pressure MAE (Pa)",
    pressureResidualMax: es
      ? "Residuo máximo de presión (Pa)"
      : "Maximum pressure residual (Pa)",
  };
  const rows = science.benchmark.rows.filter(
    (row) => row.methodId === methodId && row.split === "test",
  );
  const values = rows.map((row) => row[quantity]);
  const maximum = Math.max(0, ...values);
  const cellValue = (value: number) =>
    value !== 0 && Math.abs(value) < 0.001
      ? value.toExponential(2)
      : metric(value, 3);
  const indexed = new Map<string, BenchmarkRow>(
    rows.map((row) => [`${row.networkId}:${row.regimeId}`, row]),
  );
  return (
    <section className="av-matrix">
      <h3>
        {es
          ? "Mapa de errores por caso y régimen"
          : "Error map by case and regime"}
      </h3>
      <p className="measure">
        {es
          ? "Seleccione una celda para filtrar la tabla y la matriz de confusión. Cada valor corresponde a muestras de prueba reservadas; mayor intensidad representa mayor error dentro del método y magnitud seleccionados. Al cambiar de método se recalcula la escala, por lo que el color por sí solo no compara métodos."
          : "Select a cell to filter the table and confusion matrix. Each value belongs to held-out test samples; stronger color means larger error within the selected method and quantity. Changing method recalculates the scale, so color alone does not compare methods."}
      </p>
      <label>
        {es ? "Magnitud del mapa" : "Map quantity"}{" "}
        <select
          aria-label={es ? "Magnitud del mapa" : "Map quantity"}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value as Quantity)}
        >
          {Object.entries(labels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="av-matrix-scale">
        {methodName(methodId, es)} · {labels[quantity]} ·{" "}
        {es ? "Escala lineal" : "Linear scale"}: 0 → {cellValue(maximum)}.{" "}
        {es
          ? "Desplace la tabla para inspeccionar todos los casos y regímenes."
          : "Scroll the table to inspect every case and regime."}
      </p>
      <table
        aria-label={
          es
            ? "Mapa interactivo de errores reservados"
            : "Interactive held-out error map"
        }
      >
        <thead>
          <tr>
            <th>{es ? "Caso" : "Case"}</th>
            {science.regimes.map((regime) => (
              <th key={regime.id}>{regime.name[es ? "es" : "en"]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {catalog.cases.map((item) => (
            <tr key={item.network.id}>
              <th scope="row">{item.network.name[es ? "es" : "en"]}</th>
              {science.regimes.map((regime) => {
                const row = indexed.get(`${item.network.id}:${regime.id}`);
                const value = row?.[quantity];
                const available =
                  typeof value === "number" && Number.isFinite(value);
                const selected =
                  item.network.id === selectedCase &&
                  regime.id === selectedRegime;
                return (
                  <td key={regime.id}>
                    {row && available ? (
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${item.network.name[es ? "es" : "en"]}, ${regime.name[es ? "es" : "en"]}: ${labels[quantity]} ${cellValue(value)}`}
                        onClick={() => onSelect(item.network.id, regime.id)}
                        style={{
                          background: `color-mix(in srgb, var(--color-accent) ${maximum > 0 ? 4 + (value / maximum) * 24 : 4}%, var(--color-surface))`,
                        }}
                      >
                        <span>{cellValue(value)}</span>
                        <small>
                          {row.samples} {es ? "muestras" : "samples"}
                        </small>
                      </button>
                    ) : (
                      <span aria-label={es ? "Sin evidencia" : "No evidence"}>
                        --
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

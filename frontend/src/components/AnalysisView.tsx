import {
  ArrowRight,
  ChartNoAxesCombined,
  SlidersHorizontal,
  Wind,
} from "lucide-react";
import type {
  Network,
  Options,
  Result,
  CurvePoint,
  SensitivityPoint,
  OptimizationResult,
} from "../contracts";
import { formatNumber as number } from "../presentation";
import Numeric from "./Numeric";
import Plot from "./Plot";
import FanPlot from "./FanPlot";
import Intervals from "./Intervals";

export type AnalysisEnsemble = {
  samples: number;
  seed: number;
  cv: number;
  device: string;
  flowP05: number[];
  flowP50: number[];
  flowP95: number[];
  targetProbability: number[];
  powerP05: number;
  powerP50: number;
  powerP95: number;
  failures: number;
  parityMaxAbsFlow: number;
};

/** Display-only analysis route. Shared model, results and operations stay in App. */
export interface AnalysisViewProps {
  lang: "en" | "es";
  network: Network;
  effective: Network;
  options: Options;
  result: Result | null;
  valid: boolean;
  busy: boolean;
  analysisBusy: boolean;
  optimum: OptimizationResult | null;
  curveData: CurvePoint[];
  sensitivityData: SensitivityPoint[];
  hours: number;
  tariff: number;
  baseline: Result | null;
  ensemble?: AnalysisEnsemble;
  matchesBake: boolean;
  selected: string | null;
  selectedIndex: number;
  onAnalyze: (kind: "curve" | "sensitivity" | "optimize") => void;
  onApplySpeed: (speed: number) => void;
  onHoursChange: (hours: number) => void;
  onTariffChange: (tariff: number) => void;
  onInspect: (edgeId: string) => void;
  onSelect: (edgeId: string) => void;
}

export default function AnalysisView({
  lang,
  network,
  effective,
  options,
  result,
  valid,
  busy,
  analysisBusy,
  optimum,
  curveData,
  sensitivityData,
  hours,
  tariff,
  baseline,
  ensemble,
  matchesBake,
  selected,
  selectedIndex,
  onAnalyze,
  onApplySpeed,
  onHoursChange,
  onTariffChange,
  onInspect,
  onSelect,
}: AnalysisViewProps) {
  const b = (en: string, es: string) => (lang === "en" ? en : es);
  return (
    <section className="analysis-page">
      <div className="section-title">
        <span className="eyebrow">
          {b(
            "INTERVENE. COMPARE. UNDERSTAND.",
            "INTERVENIR. COMPARAR. COMPRENDER.",
          )}
        </span>
        <h1>{b("The operating trade-off", "El equilibrio operativo")}</h1>
        <p>
          {network.name[lang]} ·{" "}
          {b("Current network and settings", "Red y configuración actuales")}
        </p>
      </div>
      <div className="analysis-actions">
        <button
          onClick={() => onAnalyze("curve")}
          disabled={busy || analysisBusy}
        >
          <ChartNoAxesCombined size={17} />
          {b("Calculate operating envelope", "Calcular envolvente operativa")}
        </button>
        <button
          onClick={() => onAnalyze("sensitivity")}
          disabled={busy || analysisBusy}
        >
          <SlidersHorizontal size={17} />
          {b("Rank resistance sensitivity", "Ordenar sensibilidad")}
        </button>
        <button
          onClick={() => onAnalyze("optimize")}
          disabled={busy || analysisBusy}
        >
          <Wind size={17} />
          {b("Find minimum fan speed", "Buscar velocidad mínima")}
        </button>
        {analysisBusy && (
          <span role="status" className="working-indicator">
            {b("Calculating...", "Calculando...")}
          </span>
        )}
      </div>
      {optimum && (
        <div
          className={`optimization-result ${optimum.feasible ? "" : "warning"}`}
        >
          <div>
            <span className="eyebrow">
              {optimum.feasible
                ? b(
                    "FEASIBLE COMMON-SPEED SOLUTION",
                    "SOLUCIÓN FACTIBLE DE VELOCIDAD COMÚN",
                  )
                : b(
                    "NO AUTOMATIC SETTING RETURNED",
                    "SIN CONFIGURACIÓN AUTOMÁTICA",
                  )}
            </span>
            <h2>
              {optimum.feasible
                ? `${number(optimum.speed, 3)} ×`
                : b(
                    "Review the search result",
                    "Revise el resultado de la búsqueda",
                  )}
            </h2>
            <p>
              {optimum.feasible
                ? `${number(optimum.result.fanPowerKW)} kW · ${optimum.evaluations} ${b("evaluations", "evaluaciones")}`
                : optimum.result.message}
            </p>
          </div>
          {optimum.feasible && (
            <button
              className="primary"
              onClick={() => onApplySpeed(optimum.speed)}
            >
              {b("Apply setting", "Aplicar configuración")}
              <ArrowRight size={17} />
            </button>
          )}
        </div>
      )}
      <div className="analysis-grid">
        <div className="analysis-card">
          <div className="section-label">
            <span>{b("DELIVERY & ENERGY", "ENTREGA Y ENERGÍA")}</span>
            <span>{b("live", "actual")}</span>
          </div>
          <div className="big-energy">
            {valid ? number(result?.fanPowerKW) : "--"}
            <small>kW</small>
          </div>
          <p>
            {b(
              "Electrical demand at the entered fan efficiency.",
              "Demanda eléctrica con la eficiencia ingresada.",
            )}
          </p>
          <div className="numeric-row">
            <Numeric
              label={b("Operating hours", "Horas operativas")}
              value={hours}
              min={0}
              max={8784}
              step={1}
              change={onHoursChange}
              unit="h/y"
            />
            <Numeric
              label={b("Electricity tariff", "Tarifa eléctrica")}
              value={tariff}
              min={0}
              max={1000000}
              change={onTariffChange}
              unit={b("currency/kWh", "moneda/kWh")}
            />
          </div>
          <div className="cost-line">
            <span>{b("Annual energy", "Energía anual")}</span>
            <strong>
              {valid ? number((result!.fanPowerKW * hours) / 1000, 0) : "--"}{" "}
              MWh
            </strong>
          </div>
          <div className="cost-line">
            <span>
              {b(
                "Annual entered-currency cost",
                "Costo anual en moneda ingresada",
              )}
            </span>
            <strong>
              {valid ? number(result!.fanPowerKW * hours * tariff, 0) : "--"}
            </strong>
          </div>
          {baseline && (
            <div className="cost-line">
              <span>
                {b(
                  "Change from saved baseline",
                  "Cambio vs referencia guardada",
                )}
              </span>
              <strong>
                {valid
                  ? number(
                      (result!.fanPowerKW - baseline.fanPowerKW) *
                        hours *
                        tariff,
                      0,
                    )
                  : "--"}
              </strong>
            </div>
          )}
        </div>
        <div className="analysis-card">
          <div className="section-label">
            <span>{b("BOTTLENECKS", "RESTRICCIONES")}</span>
            <span>m³/s</span>
          </div>
          <p>
            {b(
              "Forward flow delivered against each entered working target. Select a branch to inspect it.",
              "Caudal hacia adelante frente al objetivo de cada labor. Seleccione una rama para inspeccionarla.",
            )}
          </p>
          <div className="target-bars">
            {effective.edges
              .map((e, i) => ({ e, i }))
              .filter(({ e }) => e.target > 0)
              .sort(
                (a, b) =>
                  (result?.shortfalls[b.i] ?? 0) -
                  (result?.shortfalls[a.i] ?? 0),
              )
              .slice(0, 9)
              .map(({ e, i }) => (
                <button key={e.id} onClick={() => onInspect(e.id)}>
                  <span>{e.name[lang]}</span>
                  <div>
                    <i
                      className={(result?.shortfalls[i] ?? 0) > 0 ? "warn" : ""}
                      style={{
                        width: `${valid ? Math.min(100, Math.max(0, (result!.flows[i] / e.target) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {valid ? number(result!.flows[i]) : "--"} /{" "}
                    {number(e.target)}
                  </strong>
                </button>
              ))}
          </div>
        </div>
      </div>
      {valid && (
        <FanPlot
          network={effective}
          options={options}
          result={result!}
          lang={lang}
        />
      )}
      {curveData.length > 0 && (
        <div className="analysis-grid">
          <Plot
            title={b(
              "Common-speed operating envelope",
              "Envolvente de velocidad común",
            )}
            xlabel={b("Speed factor", "Factor de velocidad")}
            ylabel="kW"
            series={[
              {
                label: b("Electrical power", "Potencia eléctrica"),
                color: "#dfb06d",
                values: curveData.map((p) => ({
                  x: p.speed,
                  y: p.power,
                })),
              },
            ]}
          />
          <Plot
            title={b(
              "Weakest target delivery",
              "Entrega del objetivo limitante",
            )}
            xlabel={b("Speed factor", "Factor de velocidad")}
            ylabel="%"
            series={[
              {
                label: b("Delivery", "Entrega"),
                color: "#50cbb0",
                values: curveData.map((p) => ({
                  x: p.speed,
                  y: p.targetRatio * 100,
                })),
              },
              {
                label: b("Required", "Requerido"),
                color: "#c08c81",
                values: curveData.map((p) => ({ x: p.speed, y: 100 })),
              },
            ]}
          />
        </div>
      )}
      {sensitivityData.length > 0 && (
        <div className="analysis-card">
          <div className="section-label">
            <span>
              {b("RESISTANCE SENSITIVITY", "SENSIBILIDAD A RESISTENCIA")}
            </span>
            <span>{b("+5% per airway", "+5% por galería")}</span>
          </div>
          <p>
            {b(
              "Ranked by the absolute elasticity of weakest-target delivery. This is a local perturbation, not a causal field estimate.",
              "Ordenado por elasticidad absoluta de la entrega limitante. Es una perturbación local, no una estimación causal de campo.",
            )}
          </p>
          <div className="sensitivity-list">
            {[...sensitivityData]
              .sort((a, b) => Math.abs(b.elasticity) - Math.abs(a.elasticity))
              .slice(0, 12)
              .map((s) => (
                <button key={s.edgeId} onClick={() => onInspect(s.edgeId)}>
                  <span>
                    {network.edges.find((e) => e.id === s.edgeId)?.name[lang] ??
                      s.edgeId}
                  </span>
                  <div className="sensitivity-bar">
                    <i
                      style={{
                        width: `${Math.min(100, Math.abs(s.elasticity) * 100)}%`,
                        background: s.elasticity > 0 ? "#4fc6aa" : "#e99078",
                      }}
                    />
                  </div>
                  <strong>{number(s.elasticity, 3)}</strong>
                  <small>{number(s.powerDelta, 2)} kW</small>
                </button>
              ))}
          </div>
        </div>
      )}
      <div className="analysis-card uncertainty">
        <div className="section-label">
          <span>
            {b("GPU RESISTANCE ENSEMBLE", "CONJUNTO GPU DE RESISTENCIAS")}
          </span>
          <span>
            {b("canonical offline computation", "cálculo canónico local")}
          </span>
        </div>
        {ensemble && matchesBake ? (
          <>
            <p>
              {ensemble.samples} {b("realizations", "realizaciones")} · CV{" "}
              {number(ensemble.cv * 100, 0)}% ·{" "}
              {b(
                "Independent lognormal resistance assumptions.",
                "Supuestos lognormales independientes de resistencia.",
              )}
            </p>
            <Intervals
              network={network}
              ensemble={ensemble}
              lang={lang}
              selected={selected}
              select={onSelect}
            />
            <div className="percentiles">
              {[
                ["P05", ensemble.powerP05],
                ["P50", ensemble.powerP50],
                ["P95", ensemble.powerP95],
              ].map(([l, v]) => (
                <div key={l}>
                  <span>{l}</span>
                  <strong>
                    {number(v as number)}
                    <small>kW</small>
                  </strong>
                </div>
              ))}
            </div>
            <p>
              {b(
                "These results match the original case and default controls. Changing the network invalidates this match. Run the local GPU pipeline for a new ensemble.",
                "Estos resultados corresponden al caso original y los controles iniciales. Cambiar la red invalida la coincidencia. Ejecute la cadena GPU local para un nuevo conjunto.",
              )}
            </p>
            {selectedIndex >= 0 && (
              <p>
                {b(
                  "Selected branch flow P05 / P50 / P95",
                  "Caudal de rama seleccionada P05 / P50 / P95",
                )}
                :{" "}
                <strong>
                  {number(ensemble.flowP05[selectedIndex])} /{" "}
                  {number(ensemble.flowP50[selectedIndex])} /{" "}
                  {number(ensemble.flowP95[selectedIndex])} m³/s
                </strong>
              </p>
            )}
          </>
        ) : (
          <p>
            {b(
              "The current edits have no matching baked ensemble. Export a project, including network and settings, and use the local GPU processing script to calculate uncertainty for these exact inputs. Live deterministic tools remain available.",
              "Los cambios actuales no tienen un conjunto precalculado coincidente. Exporte un proyecto, con red y configuración, y use el script GPU local para calcular la incertidumbre de estas entradas exactas. Las herramientas deterministas siguen disponibles.",
            )}
          </p>
        )}
      </div>
    </section>
  );
}

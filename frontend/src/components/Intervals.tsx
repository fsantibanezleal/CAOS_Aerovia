import type { Network } from "../contracts";
export default function Intervals({
  network,
  ensemble,
  lang,
  selected,
  select,
}: {
  network: Network;
  ensemble: {
    flowP05: number[];
    flowP50: number[];
    flowP95: number[];
    targetProbability: number[];
  };
  lang: "en" | "es";
  selected: string | null;
  select: (id: string) => void;
}) {
  const rows = network.edges
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.target > 0);
  const min = Math.min(0, ...rows.map(({ i }) => ensemble.flowP05[i])),
    max = Math.max(
      1,
      ...rows.map(({ e, i }) => Math.max(e.target, ensemble.flowP95[i])),
    );
  const x = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="intervals">
      <div className="interval-head">
        <span>{lang === "en" ? "Working airway" : "Galería de trabajo"}</span>
        <span>
          P05 · P50 · P95 <small>m³/s</small>
        </span>
        <span>
          {lang === "en" ? "Samples meeting target" : "Muestras que cumplen"}
        </span>
      </div>
      {rows.map(({ e, i }) => (
        <button
          key={e.id}
          className={selected === e.id ? "active" : ""}
          onClick={() => select(e.id)}
          title={`${e.name[lang]}: ${ensemble.flowP05[i].toFixed(2)} / ${ensemble.flowP50[i].toFixed(2)} / ${ensemble.flowP95[i].toFixed(2)} m³/s`}
        >
          <span>{e.name[lang]}</span>
          <div className="interval-track">
            <i
              className="interval-band"
              style={{
                left: `${x(ensemble.flowP05[i])}%`,
                width: `${((ensemble.flowP95[i] - ensemble.flowP05[i]) / (max - min)) * 100}%`,
              }}
            />
            <i
              className="interval-median"
              style={{ left: `${x(ensemble.flowP50[i])}%` }}
            />
            <i
              className="interval-target"
              style={{ left: `${x(e.target)}%` }}
            />
          </div>
          <strong>{(ensemble.targetProbability[i] * 100).toFixed(1)}%</strong>
        </button>
      ))}
      <div className="interval-head">
        <span>
          {lang === "en"
            ? "Assumed resistance uncertainty"
            : "Incertidumbre supuesta de resistencia"}
        </span>
        <span>
          {min.toFixed(0)}
          <span style={{ float: "right" }}>{max.toFixed(0)} m³/s</span>
        </span>
        <span>
          {lang === "en" ? "Target: amber tick" : "Objetivo: marca ámbar"}
        </span>
      </div>
    </div>
  );
}

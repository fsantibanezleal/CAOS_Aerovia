import { Download, FileJson, Search } from "lucide-react";
import type { Network, Options, Result } from "../contracts";
import { formatNumber as number } from "../presentation";

/** Table rendering and user intents; persistence and topology changes stay in App. */
export interface NetworkViewProps {
  lang: "en" | "es";
  network: Network;
  options: Options;
  result: Result | null;
  valid: boolean;
  busy: boolean;
  filtered: Network["edges"];
  selected: string | null;
  closed: ReadonlySet<string>;
  search: string;
  onSearch: (query: string) => void;
  onInspect: (edgeId: string) => void;
  onEditTopology: () => void;
  onExportNetwork: () => void;
  onExportResults: () => void;
}

export default function NetworkView({
  lang,
  network,
  options,
  result,
  valid,
  busy,
  filtered,
  selected,
  closed,
  search,
  onSearch,
  onInspect,
  onEditTopology,
  onExportNetwork,
  onExportResults,
}: NetworkViewProps) {
  const b = (en: string, es: string) => (lang === "en" ? en : es);
  return (
    <section className="network-page">
      <div className="section-title">
        <span className="eyebrow">
          {b("YOUR DATA, YOUR WORKSPACE", "SUS DATOS, SU ESPACIO")}
        </span>
        <h1>{b("A network you can work with.", "Una red para trabajar.")}</h1>
        <p>
          {b(
            "Select an airway to edit its properties. Modify the complete topology through the validated network editor.",
            "Seleccione una galería para editar sus propiedades. Modifique la topología completa en el editor validado.",
          )}
        </p>
      </div>
      <div className="network-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label={b("Find airway", "Buscar galería")}
            placeholder={b("Find an airway...", "Buscar una galería...")}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        <button onClick={onEditTopology}>
          <FileJson size={16} />
          {b("Edit topology", "Editar topología")}
        </button>
        <button onClick={onExportNetwork}>
          <Download size={16} />
          JSON
        </button>
        <button onClick={onExportResults} disabled={!result || busy}>
          <Download size={16} />
          {b("Results CSV", "Resultados CSV")}
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                b("Airway", "Galería"),
                b("Connections", "Conexiones"),
                b("Role", "Tipo"),
                "Q [m³/s]",
                "v [m/s]",
                "R [Pa·s²/m⁶]",
                b("Target [m³/s]", "Objetivo [m³/s]"),
                b("State", "Estado"),
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const i = network.edges.findIndex((x) => x.id === e.id);
              return (
                <tr key={e.id} className={selected === e.id ? "selected" : ""}>
                  <td>
                    <button onClick={() => onInspect(e.id)}>
                      {e.name[lang]}
                      <small>{e.id}</small>
                    </button>
                  </td>
                  <td>
                    {e.from}
                    <br />
                    {e.to}
                  </td>
                  <td>{e.kind}</td>
                  <td>{valid ? number(result!.flows[i], 2) : "--"}</td>
                  <td>{valid ? number(result!.velocities[i], 2) : "--"}</td>
                  <td>{number(e.resistance * options.resistanceScale, 4)}</td>
                  <td>{e.target > 0 ? number(e.target) : "--"}</td>
                  <td>
                    <span
                      className={`status-dot ${closed.has(e.id) ? "muted" : (result?.shortfalls[i] ?? 0) > 0 ? "warn" : ""}`}
                    />
                    {closed.has(e.id)
                      ? b("Closed", "Cerrada")
                      : (result?.shortfalls[i] ?? 0) > 0
                        ? b("Below target", "Bajo objetivo")
                        : b("Open", "Abierta")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        {filtered.length} / {network.edges.length} {b("airways", "galerías")} ·{" "}
        {b(
          "Signed flows follow the from → to direction.",
          "El signo del caudal sigue la dirección origen → destino.",
        )}
      </div>
    </section>
  );
}

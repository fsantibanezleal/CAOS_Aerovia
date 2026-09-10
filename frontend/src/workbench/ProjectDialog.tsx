import { useEffect, useRef, useState } from "react";
import { X, Upload, FilePlus2, Download } from "lucide-react";
import type { WorkbenchState } from "./useWorkbench";
import { DEFAULT_OPTIONS } from "../engine";
import { newDesign } from "../engine/editor";
import {
  parseTable,
  suggestMapping,
  networkFromTables,
  networkTables,
  NODE_FIELDS,
  EDGE_FIELDS,
  type Table,
  type ColumnMap,
} from "../engine/tableImport";
import { download } from "../storage";
import CaseContext from "../content/CaseContext";

export default function ProjectDialog({
  w,
  kind,
  close,
}: {
  w: WorkbenchState;
  kind: "new" | "import" | "tables" | "context";
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [name, setName] = useState(
      w.b("My ventilation design", "Mi diseño de ventilación"),
    ),
    [error, setError] = useState("");
  const [nodes, setNodes] = useState<Table | null>(null),
    [edges, setEdges] = useState<Table | null>(null),
    [nodeMap, setNodeMap] = useState<ColumnMap>({}),
    [edgeMap, setEdgeMap] = useState<ColumnMap>({}),
    [units, setUnits] = useState<"m" | "ft">("m");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const b = w.b;
  async function file(
    file: File | undefined,
    kind: "nodes" | "edges" | "project",
  ) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 2_000_000)
        throw new Error(b("File exceeds 2 MB.", "El archivo supera 2 MB."));
      const text = await file.text();
      if (kind === "project") {
        if (w.importText(text)) close();
        else
          setError(
            b(
              "Project validation failed. Review the reported error and choose a corrected file.",
              "La validación falló. Revise el error informado y elija un archivo corregido.",
            ),
          );
        return;
      }
      const table = parseTable(text);
      if (kind === "nodes") {
        setNodes(table);
        setNodeMap(suggestMapping(table, NODE_FIELDS));
      } else {
        setEdges(table);
        setEdgeMap(suggestMapping(table, EDGE_FIELDS));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function mappings(
    table: Table,
    map: ColumnMap,
    set: (v: ColumnMap) => void,
    fields: readonly string[],
    label: string,
  ) {
    return (
      <fieldset>
        <legend>
          {label} · {table.rows.length} {b("rows", "filas")}
        </legend>
        <div className="av-mapping">
          {fields.map((f) => (
            <label key={f}>
              {f}
              <select
                aria-label={`${label} ${f}`}
                value={map[f] ?? ""}
                onChange={(e) => set({ ...map, [f]: e.target.value })}
              >
                <option value="">{b("Not mapped", "Sin asignar")}</option>
                {table.columns.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <dialog ref={ref} className="av-dialog" onCancel={close} onClose={close}>
      <header>
        <h2>
          {kind === "new"
            ? b("Create a design", "Crear diseño")
            : kind === "context"
              ? b("Case guide", "Guía del caso")
              : kind === "tables"
                ? b("Network tables", "Tablas de la red")
                : b("Load a design", "Cargar diseño")}
        </h2>
        <button
          className="icon-btn"
          aria-label={b("Close", "Cerrar")}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <div className="av-dialog-body">
        {kind === "context" ? (
          <CaseContext network={w.network!} />
        ) : kind === "new" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              w.change(newDesign(name), structuredClone(DEFAULT_OPTIONS));
              w.setSelected("shaft-1");
              w.setCameraReset((v) => v + 1);
              close();
            }}
          >
            <p>
              {b(
                "Start with a surface boundary and a shaft. Draw connected airways, add an outlet and place a fan to create an operating circuit.",
                "Comience con una conexión a superficie y un pique. Dibuje galerías conectadas, agregue una salida e instale un ventilador para crear un circuito operativo.",
              )}
            </p>
            <label>
              {b("Project name", "Nombre del proyecto")}
              <input
                value={name}
                maxLength={100}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="av-primary" type="submit">
              <FilePlus2 size={16} />
              {b("Create design", "Crear diseño")}
            </button>
          </form>
        ) : kind === "tables" ? (
          <>
            <div className="av-actions">
              <button
                onClick={() =>
                  download(
                    "junctions.csv",
                    networkTables(w.effective!).nodes,
                    "text/csv",
                  )
                }
              >
                <Download size={16} />
                {b("Junction CSV", "CSV de uniones")}
              </button>
              <button
                onClick={() =>
                  download(
                    "airways.csv",
                    networkTables(w.effective!).airways,
                    "text/csv",
                  )
                }
              >
                <Download size={16} />
                {b("Airway CSV", "CSV de galerías")}
              </button>
              <button disabled={!w.valid} onClick={w.exportCSV}>
                <Download size={16} />
                {b("Results CSV", "CSV de resultados")}
              </button>
            </div>
            <p>
              {b(
                "Select a row to edit it in the workspace. Coordinates are metres. Resistances are independent hydraulic inputs.",
                "Seleccione una fila para editarla. Las coordenadas están en metros. Las resistencias son entradas hidráulicas independientes.",
              )}
            </p>
            <p className="av-hint">
              {b(
                "Table files contain geometry and airway inputs. Save a project to retain operating multipliers, closures and the baseline as well.",
                "Las tablas contienen geometría y entradas de galerías. Guarde un proyecto para conservar también multiplicadores operativos, cierres y referencia.",
              )}
            </p>
            <div className="av-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{b("Airway", "Galería")}</th>
                    <th>{b("From → to", "Desde → hasta")}</th>
                    <th>m²</th>
                    <th>R · Pa·s²/m⁶</th>
                    <th>Q · m³/s</th>
                  </tr>
                </thead>
                <tbody>
                  {w.effective!.edges.map((e, i) => (
                    <tr key={e.id}>
                      <td>
                        <button
                          onClick={() => {
                            w.setSelected(e.id);
                            close();
                          }}
                        >
                          {e.name[w.lang]}
                        </button>
                      </td>
                      <td>
                        {e.from} → {e.to}
                      </td>
                      <td>{e.area}</td>
                      <td>{e.resistance.toPrecision(3)}</td>
                      <td>{w.valid ? w.result!.flows[i].toFixed(2) : "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <p>
              {b(
                "Files are parsed on this device. Load a saved project, or map two CSV tables. The current design is replaced only after validation succeeds.",
                "Los archivos se procesan en este dispositivo. Cargue un proyecto guardado o asigne dos tablas CSV. El diseño actual solo se reemplaza después de validar.",
              )}
            </p>
            <label className="av-file">
              <Upload size={17} />
              {b(
                "Saved project or network JSON",
                "Proyecto guardado o red JSON",
              )}
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => file(e.target.files?.[0], "project")}
              />
            </label>
            <h3>
              {b("Import junctions and airways", "Importar uniones y galerías")}
            </h3>
            <div className="two-col">
              <label>
                {b("Junction CSV", "CSV de uniones")}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => file(e.target.files?.[0], "nodes")}
                />
              </label>
              <label>
                {b("Airway CSV", "CSV de galerías")}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => file(e.target.files?.[0], "edges")}
                />
              </label>
            </div>
            {nodes &&
              mappings(
                nodes,
                nodeMap,
                setNodeMap,
                NODE_FIELDS,
                b("Junctions", "Uniones"),
              )}
            {edges &&
              mappings(
                edges,
                edgeMap,
                setEdgeMap,
                EDGE_FIELDS,
                b("Airways", "Galerías"),
              )}
            <label>
              {b("Geometry units", "Unidades geométricas")}
              <select
                value={units}
                onChange={(e) => setUnits(e.target.value as "m" | "ft")}
              >
                <option value="m">
                  {b("metres / square metres", "metros / metros cuadrados")}
                </option>
                <option value="ft">
                  {b("feet / square feet", "pies / pies cuadrados")}
                </option>
              </select>
            </label>
            <p className="av-hint">
              {b(
                "Pressure: Pa. Resistance: Pa·s²/m⁶. Flow: m³/s. At least one junction needs a fixed boundary pressure. Blank boundary means an internal junction.",
                "Presión: Pa. Resistencia: Pa·s²/m⁶. Caudal: m³/s. Se necesita al menos una unión con presión de frontera fija. Una frontera vacía indica una unión interna.",
              )}
            </p>
            <button
              className="av-primary"
              disabled={!nodes || !edges}
              onClick={() => {
                try {
                  const n = networkFromTables(
                    nodes!,
                    edges!,
                    nodeMap,
                    edgeMap,
                    units,
                    name,
                  );
                  w.change(n, structuredClone(DEFAULT_OPTIONS));
                  w.setSelected(n.edges[0].id);
                  w.setCameraReset((v) => v + 1);
                  close();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {b("Validate and load tables", "Validar y cargar tablas")}
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="av-error">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}

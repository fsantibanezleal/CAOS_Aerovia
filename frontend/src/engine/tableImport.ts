import Papa from "papaparse";
import type { Network, NetworkEdge } from "../contracts";
import { LIMITS, validateNetwork } from "./validation";

export type Table = { columns: string[]; rows: Record<string, string>[] };
export type ColumnMap = Record<string, string>;
export const NODE_FIELDS = ["id", "x", "y", "z", "boundary"] as const;
export const EDGE_FIELDS = [
  "id",
  "from",
  "to",
  "name",
  "nameEn",
  "nameEs",
  "kind",
  "area",
  "resistance",
  "target",
  "level",
  "fanPressure",
  "fanCoefficient",
  "fanEfficiency",
] as const;
export const TABLE_LIMITS = Object.freeze({
  bytes: 2_000_000,
  rows: 1000,
  columns: 64,
});
const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
const normalized = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

function validateTable(table: Table, at: string): void {
  if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows))
    throw new Error(`${at} must contain columns and rows.`);
  if (table.columns.length < 1 || table.columns.length > TABLE_LIMITS.columns)
    throw new Error(`${at} needs 1–${TABLE_LIMITS.columns} columns.`);
  if (
    table.columns.some(
      (column) =>
        typeof column !== "string" ||
        !column.trim() ||
        column.length > 200 ||
        ["__proto__", "constructor", "prototype"].includes(column),
    )
  )
    throw new Error(
      `${at} has an empty, oversized or unsupported column heading.`,
    );
  if (new Set(table.columns).size !== table.columns.length)
    throw new Error(
      "Duplicate column headings. Give each column a unique name.",
    );
  if (table.rows.length < 1 || table.rows.length > TABLE_LIMITS.rows)
    throw new Error(`${at} needs 1–${TABLE_LIMITS.rows} data rows.`);
  const columns = new Set(table.columns);
  table.rows.forEach((row, i) => {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      Object.keys(row).length !== columns.size ||
      Object.keys(row).some((key) => !columns.has(key)) ||
      table.columns.some(
        (column) => !own(row, column) || typeof row[column] !== "string",
      )
    )
      throw new Error(`${at} row ${i + 2} does not match its column headings.`);
  });
}

export function parseTable(text: string): Table {
  if (typeof text !== "string") throw new Error("CSV input must be text.");
  if (new TextEncoder().encode(text).byteLength > TABLE_LIMITS.bytes)
    throw new Error("CSV exceeds 2 MB (2000000 UTF-8 bytes).");
  const result = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (heading) => heading.trim(),
    },
  );
  if (Object.keys(result.meta.renamedHeaders ?? {}).length)
    throw new Error(
      "Duplicate column headings. Give each column a unique name.",
    );
  if (result.errors.length)
    throw new Error(
      `CSV row ${(result.errors[0].row ?? 0) + 2}: ${result.errors[0].message}`,
    );
  const table = { columns: result.meta.fields ?? [], rows: result.data };
  validateTable(table, "CSV");
  return table;
}

/** Ambiguous aliases remain unmapped; the user must choose a source column. */
export function suggestMapping(
  table: Table,
  fields: readonly string[],
): ColumnMap {
  validateTable(table, "Table");
  const aliases: Record<string, string[]> = {
    id: ["id", "nodeid", "edgeid", "junctionid", "airwayid"],
    x: ["x", "easting", "xm"],
    y: ["y", "northing", "ym"],
    z: ["z", "elevation", "zm"],
    from: ["from", "fromid", "start"],
    to: ["to", "toid", "end"],
    name: ["name", "label"],
    nameEn: ["nameen", "englishname"],
    nameEs: ["namees", "spanishname"],
    area: ["area", "aream2"],
    resistance: ["resistance", "r"],
    target: ["target", "targetm3s"],
    boundary: ["boundary", "pressurepa"],
    fanPressure: ["fanpressure", "fanpressurepa"],
    fanCoefficient: ["fancoefficient"],
    fanEfficiency: ["fanefficiency"],
  };
  return Object.fromEntries(
    fields.map((field) => {
      const matches = table.columns.filter((column) =>
        (aliases[field] ?? [field.toLowerCase()]).includes(normalized(column)),
      );
      return [field, matches.length === 1 ? matches[0] : ""];
    }),
  );
}

function validateMapping(
  table: Table,
  mapping: ColumnMap,
  fields: readonly string[],
  required: readonly string[],
  at: string,
): void {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping))
    throw new Error(`${at} column mapping must be an object.`);
  const assigned = new Map<string, string>();
  for (const [field, column] of Object.entries(mapping)) {
    if (!fields.includes(field))
      throw new Error(`Unknown ${at.toLowerCase()} field ${field}.`);
    if (typeof column !== "string")
      throw new Error(`${at} ${field} must map to a column name.`);
    if (!column) continue;
    if (!table.columns.includes(column))
      throw new Error(`${at} ${field} refers to missing column ${column}.`);
    if (assigned.has(column))
      throw new Error(
        `${at} column ${column} is mapped to both ${assigned.get(column)} and ${field}. Select distinct columns.`,
      );
    assigned.set(column, field);
  }
  for (const field of required)
    if (!own(mapping, field) || !mapping[field])
      throw new Error(`Map ${at.toLowerCase()} ${field}.`);
}

/** Pure transaction: build a complete candidate, then validate before returning. */
export function networkFromTables(
  nodes: Table,
  airways: Table,
  nodeMap: ColumnMap,
  edgeMap: ColumnMap,
  units: "m" | "ft",
  name: string,
): Network {
  validateTable(nodes, "Junction table");
  validateTable(airways, "Airway table");
  if (nodes.rows.length > LIMITS.nodes || airways.rows.length > LIMITS.edges)
    throw new Error(
      `A network supports at most ${LIMITS.nodes} junctions and ${LIMITS.edges} airways.`,
    );
  if (units !== "m" && units !== "ft")
    throw new Error(
      "Select geometry units m (m²) or ft (ft²). Hydraulic values must remain in SI units.",
    );
  validateMapping(
    nodes,
    nodeMap,
    NODE_FIELDS,
    ["id", "x", "y", "z"],
    "Junction",
  );
  validateMapping(
    airways,
    edgeMap,
    EDGE_FIELDS,
    ["id", "from", "to", "area", "resistance"],
    "Airway",
  );
  const length = units === "ft" ? 0.3048 : 1;
  const rawField = (
    row: Record<string, string>,
    map: ColumnMap,
    key: string,
  ) => (own(map, key) && map[key] && own(row, map[key]) ? row[map[key]] : "");
  const field = (row: Record<string, string>, map: ColumnMap, key: string) =>
    rawField(row, map, key).trim();
  const label = (row: Record<string, string>, key: string) => {
    const value = rawField(row, edgeMap, key);
    return value.trim() ? value : "";
  };
  function number(
    row: Record<string, string>,
    map: ColumnMap,
    key: string,
    at: string,
    fallback?: number,
  ): number {
    const text = field(row, map, key);
    if (!text && fallback !== undefined) return fallback;
    const value = Number(text);
    if (
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ||
      !Number.isFinite(value)
    )
      throw new Error(`${at}: ${key} must be a finite decimal number.`);
    return value;
  }
  return validateNetwork({
    schema: "aerovia.network/v1",
    id: "imported-tables",
    name: { en: name, es: name },
    description: {
      en: "Design imported from junction and airway tables.",
      es: "Diseño importado de tablas de uniones y galerías.",
    },
    provenance: {
      kind: "imported",
      source: "Local user tables; source filenames are not published",
      license: "User-defined",
    },
    nodes: nodes.rows.map((row, i) => {
      const at = `Junction row ${i + 2}`;
      const pressure = field(row, nodeMap, "boundary");
      return {
        id: field(row, nodeMap, "id"),
        x: number(row, nodeMap, "x", at) * length,
        y: number(row, nodeMap, "y", at) * length,
        z: number(row, nodeMap, "z", at) * length,
        ...(pressure ? { boundary: number(row, nodeMap, "boundary", at) } : {}),
      };
    }),
    edges: airways.rows.map((row, i): NetworkEdge => {
      const at = `Airway row ${i + 2}`;
      const id = field(row, edgeMap, "id");
      const sharedName = label(row, "name");
      const en = label(row, "nameEn");
      const es = label(row, "nameEs");
      const kind = (field(row, edgeMap, "kind") ||
        "working") as NetworkEdge["kind"];
      if (
        kind !== "fan" &&
        ["fanPressure", "fanCoefficient", "fanEfficiency"].some((key) =>
          field(row, edgeMap, key),
        )
      )
        throw new Error(
          `${at}: fan parameters require kind=fan; they were not discarded.`,
        );
      return {
        id,
        from: field(row, edgeMap, "from"),
        to: field(row, edgeMap, "to"),
        name: {
          en: en || sharedName || es || id,
          es: es || sharedName || en || id,
        },
        kind,
        area: number(row, edgeMap, "area", at) * length * length,
        resistance: number(row, edgeMap, "resistance", at),
        target: number(row, edgeMap, "target", at, 0),
        level: number(row, edgeMap, "level", at, 0),
        ...(kind === "fan"
          ? {
              fan: {
                pressure: number(row, edgeMap, "fanPressure", at),
                coefficient: number(row, edgeMap, "fanCoefficient", at),
                efficiency: number(row, edgeMap, "fanEfficiency", at),
              },
            }
          : {}),
      };
    }),
  });
}

/** Exports base network geometry/equipment in SI, preserving both languages. */
export function networkTables(input: Network): {
  nodes: string;
  airways: string;
} {
  const network = validateNetwork(input);
  return {
    nodes: Papa.unparse(
      network.nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        z: node.z,
        boundary: node.boundary ?? "",
      })),
    ),
    airways: Papa.unparse(
      network.edges.map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        nameEn: edge.name.en,
        nameEs: edge.name.es,
        kind: edge.kind,
        area: edge.area,
        resistance: edge.resistance,
        target: edge.target,
        level: edge.level,
        fanPressure: edge.fan?.pressure ?? "",
        fanCoefficient: edge.fan?.coefficient ?? "",
        fanEfficiency: edge.fan?.efficiency ?? "",
      })),
    ),
  };
}

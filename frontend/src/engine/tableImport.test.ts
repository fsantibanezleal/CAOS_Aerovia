import { describe, it, expect } from "vitest";
import { newDesign, drawAirway } from "./editor";
import {
  networkTables,
  parseTable,
  suggestMapping,
  networkFromTables,
  NODE_FIELDS,
  EDGE_FIELDS,
  type Table,
} from "./tableImport";

function fixture() {
  const original = newDesign("Existing design");
  const raw = networkTables(original);
  const nodes = parseTable(raw.nodes),
    edges = parseTable(raw.airways);
  return {
    original,
    nodes,
    edges,
    nodeMap: suggestMapping(nodes, NODE_FIELDS),
    edgeMap: suggestMapping(edges, EDGE_FIELDS),
  };
}
function load(data = fixture()) {
  return networkFromTables(
    data.nodes,
    data.edges,
    data.nodeMap,
    data.edgeMap,
    "m",
    "Imported design",
  );
}
describe("table design import", () => {
  it("round-trips geometry and fan equipment through independent files", () => {
    const n = drawAirway(
      newDesign("Round trip"),
      "junction-1",
      { x: 40, y: 10, z: -30 },
      { area: 10, resistance: 0.2, target: 5, level: 1, kind: "fan" },
    ).network;
    const raw = networkTables(n),
      nodes = parseTable(raw.nodes),
      edges = parseTable(raw.airways);
    const result = networkFromTables(
      nodes,
      edges,
      suggestMapping(nodes, NODE_FIELDS),
      suggestMapping(edges, EDGE_FIELDS),
      "m",
      "Round trip",
    );
    expect(result.nodes).toEqual(n.nodes);
    expect(result.edges).toEqual(n.edges);
  });
  it("parses quoted valid identifiers and labels, maps headers and converts feet and square feet explicitly", () => {
    const nodes = parseTable(
      'Node ID,Easting,Northing,Elevation,pressure_pa\n"surface-1",0,0,0,0\nend,100,0,-10,0',
    );
    const edges = parseTable(
      'ID,Start,End,Area,R,name\na,"surface-1",end,100,0.2,"Intake, north"',
    );
    const result = networkFromTables(
      nodes,
      edges,
      suggestMapping(nodes, NODE_FIELDS),
      suggestMapping(edges, EDGE_FIELDS),
      "ft",
      "Feet",
    );
    expect(result.nodes[1].x).toBeCloseTo(30.48);
    expect(result.edges[0].area).toBeCloseTo(9.290304);
    expect(result.edges[0].resistance).toBe(0.2);
    expect(result.nodes[1].z).toBeCloseTo(-3.048);
    expect(result.edges[0].name.en).toBe("Intake, north");
  });
  it("rejects duplicate headings and a dangling connection before changing a design", () => {
    expect(() => parseTable("id,id\na,b")).toThrow("Duplicate");
    const n = parseTable("id,x,y,z,boundary\na,0,0,0,0\nb,1,0,0,0"),
      e = parseTable("id,from,to,area,resistance\ne,a,missing,10,1");
    expect(() =>
      networkFromTables(
        n,
        e,
        suggestMapping(n, NODE_FIELDS),
        suggestMapping(e, EDGE_FIELDS),
        "m",
        "Bad",
      ),
    ).toThrow();
  });
  it("round-trips bilingual labels including Unicode, commas, quotes, line breaks and intentional whitespace", () => {
    const network = newDesign();
    network.edges[0].name = {
      en: ' North, "intake"\nshaft ',
      es: ' Pique de admisión, "norte"\nprincipal ',
    };
    const raw = networkTables(network),
      nodes = parseTable(raw.nodes),
      edges = parseTable(raw.airways);
    expect(edges.columns).toContain("nameEn");
    expect(edges.columns).toContain("nameEs");
    const imported = networkFromTables(
      nodes,
      edges,
      suggestMapping(nodes, NODE_FIELDS),
      suggestMapping(edges, EDGE_FIELDS),
      "m",
      "Labels",
    );
    expect(imported.edges).toEqual(network.edges);
  });
  it("uses explicit per-language names before shared fallback and never translates invented text", () => {
    const data = fixture();
    data.edges.columns.push("name");
    data.edges.rows[0].name = "Shared name";
    data.edgeMap = suggestMapping(data.edges, EDGE_FIELDS);
    data.edges.rows[0].nameEn = "English";
    data.edges.rows[0].nameEs = "Español";
    expect(load(data).edges[0].name).toEqual({ en: "English", es: "Español" });
    data.edges.rows[0].nameEs = "";
    expect(load(data).edges[0].name).toEqual({
      en: "English",
      es: "Shared name",
    });
    data.edges.rows[0].name = "";
    expect(load(data).edges[0].name).toEqual({ en: "English", es: "English" });
    data.edges.rows[0].nameEn = "";
    expect(load(data).edges[0].name).toEqual({ en: "shaft-1", es: "shaft-1" });
  });
  it("imports BOM-prefixed CRLF files with whitespace around headers and empty trailing lines", () => {
    const nodes = parseTable(
      "\uFEFF id , x , y , z , boundary \r\na,0,0,0,0\r\nb,10,0,0,\r\n\r\n",
    );
    const edges = parseTable("id,from,to,area,resistance\r\nab,a,b,10,0.1\r\n");
    const result = networkFromTables(
      nodes,
      edges,
      suggestMapping(nodes, NODE_FIELDS),
      suggestMapping(edges, EDGE_FIELDS),
      "m",
      "BOM",
    );
    expect(result.nodes[0].boundary).toBe(0);
    expect(result.nodes[1].boundary).toBeUndefined();
    expect(result.edges[0]).toMatchObject({
      kind: "working",
      target: 0,
      level: 0,
    });
  });
  it("rejects unknown geometry units instead of assuming metres", () => {
    const data = fixture();
    expect(() =>
      networkFromTables(
        data.nodes,
        data.edges,
        data.nodeMap,
        data.edgeMap,
        "km" as "m",
        "Wrong units",
      ),
    ).toThrow(/geometry units/);
  });
  it("converts geometry alone while retaining pressure, resistance, target and fan curve SI inputs", () => {
    const data = fixture();
    const row = data.edges.rows[0];
    row.kind = "fan";
    row.area = "100";
    row.fanPressure = "1200";
    row.fanCoefficient = "0.02";
    row.fanEfficiency = "0.8";
    row.target = "30";
    const result = networkFromTables(
      data.nodes,
      data.edges,
      data.nodeMap,
      data.edgeMap,
      "ft",
      "Units",
    );
    expect(result.edges[0].area).toBeCloseTo(9.290304, 9);
    expect(result.edges[0].resistance).toBe(0.1);
    expect(result.edges[0].target).toBe(30);
    expect(result.edges[0].fan).toEqual({
      pressure: 1200,
      coefficient: 0.02,
      efficiency: 0.8,
    });
    expect(result.nodes[0].boundary).toBe(0);
  });
});

describe("CSV structural and mapping validation", () => {
  it.each([
    ["duplicate headers", "id,id\na,b"],
    ["whitespace duplicate headers", "id, id \na,b"],
    ["missing row field", "id,x,y\na,1"],
    ["surplus row field", "id,x\na,1,2"],
    ["unterminated quote", 'id,x\na,"unterminated'],
    ["empty header", "id,,z\na,1,2"],
    ["no data", "id,x,y\n"],
    ["reserved property header", "__proto__,x\na,1"],
  ])("rejects %s", (_name, text) => expect(() => parseTable(text)).toThrow());
  it("enforces the UTF-8 byte limit rather than JavaScript string length", () => {
    expect(() => parseTable("id,name\na," + "á".repeat(1_000_000))).toThrow(
      /UTF-8 bytes/,
    );
  });
  it("does not silently choose among multiple plausible identifier headings", () => {
    const table = parseTable("ID,Node ID,x,y,z,boundary\na,b,0,0,0,0");
    expect(suggestMapping(table, NODE_FIELDS).id).toBe("");
  });
  it("rejects missing required, nonexistent optional and multiply assigned mapping columns", () => {
    const missing = fixture();
    missing.nodeMap.z = "";
    expect(() => load(missing)).toThrow(/Map junction z/);
    const unknown = fixture();
    unknown.edgeMap.target = "not-in-file";
    expect(() => load(unknown)).toThrow(/missing column/);
    const duplicate = fixture();
    duplicate.nodeMap.y = duplicate.nodeMap.x;
    expect(() => load(duplicate)).toThrow(/mapped to both/);
  });
  it("validates direct Table callers rather than trusting parser-only checks", () => {
    const badRows: Table[] = [
      { columns: ["id", "x"], rows: [{ id: "a" }] },
      { columns: ["id"], rows: [{ id: "a", extra: "b" }] },
      { columns: ["id", "id"], rows: [{ id: "a" }] },
      { columns: ["id"], rows: [] },
    ];
    for (const nodes of badRows) {
      const data = fixture();
      data.nodes = nodes;
      expect(() => load(data)).toThrow();
    }
  });
  it("enforces network row caps before allocating an oversized design", () => {
    const data = fixture();
    data.nodes.rows = Array.from({ length: 121 }, () => ({
      ...data.nodes.rows[0],
    }));
    expect(() => load(data)).toThrow(/120 junctions/);
    expect(() => parseTable("id,x\n" + "a,1\n".repeat(1001))).toThrow(
      /1000 data rows/,
    );
  });
});

describe("numeric, equipment and referential import validation", () => {
  it.each([
    "",
    "NaN",
    "Infinity",
    "-Infinity",
    "0x10",
    "=1+1",
    "1_000",
    "1,000",
    "12 m2",
    "1e999",
  ])("rejects invalid required numeric value %s", (value) => {
    const data = fixture();
    data.edges.rows[0].area = value;
    expect(() => load(data)).toThrow(/finite decimal/);
  });
  it("accepts decimal scientific notation with explicit signs", () => {
    const data = fixture();
    data.edges.rows[0].resistance = "+2e-1";
    data.nodes.rows[1].x = "-3.05e2";
    expect(load(data).edges[0].resistance).toBe(0.2);
    expect(load(data).nodes[1].x).toBe(-305);
  });
  it.each(["fanPressure", "fanCoefficient", "fanEfficiency"])(
    "requires %s for a fan rather than inventing equipment data",
    (field) => {
      const data = fixture();
      Object.assign(data.edges.rows[0], {
        kind: "fan",
        fanPressure: "1000",
        fanCoefficient: "0.02",
        fanEfficiency: "0.8",
        [field]: "",
      });
      expect(() => load(data)).toThrow(new RegExp(field));
    },
  );
  it("rejects fan values on a passive branch rather than silently discarding them", () => {
    const data = fixture();
    data.edges.rows[0].fanPressure = "0";
    expect(() => load(data)).toThrow(/require kind=fan/);
  });
  it.each([
    ["area", "0"],
    ["resistance", "-1"],
    ["target", "-1"],
    ["level", "101"],
    ["fanPressure", "100001"],
    ["fanCoefficient", "-0.01"],
    ["fanEfficiency", "1.1"],
    ["fanEfficiency", "0.01"],
  ])("rejects out-of-contract %s=%s", (field, value) => {
    const data = fixture();
    Object.assign(data.edges.rows[0], {
      kind: "fan",
      fanPressure: "1000",
      fanCoefficient: "0.02",
      fanEfficiency: "0.8",
      [field]: value,
    });
    expect(() => load(data)).toThrow();
  });
  it("rejects duplicate identities, self-loops, missing endpoints and unanchored nodes", () => {
    const cases = [fixture(), fixture(), fixture(), fixture(), fixture()];
    cases[0].nodes.rows[1].id = cases[0].nodes.rows[0].id;
    cases[1].edges.rows.push({ ...cases[1].edges.rows[0] });
    cases[2].edges.rows[0].to = cases[2].edges.rows[0].from;
    cases[3].edges.rows[0].to = "missing";
    cases[4].nodes.rows.push({
      id: "orphan",
      x: "30",
      y: "0",
      z: "0",
      boundary: "",
    });
    for (const data of cases) expect(() => load(data)).toThrow();
  });
  it("requires an explicit pressure boundary and preserves a genuine zero boundary", () => {
    const data = fixture();
    expect(load(data).nodes[0].boundary).toBe(0);
    data.nodes.rows[0].boundary = "";
    expect(() => load(data)).toThrow(/fixed-pressure boundary/);
  });
  it("leaves the previously committed design and all source tables unchanged after late validation failure", () => {
    const data = fixture();
    let current = data.original;
    const committed = current;
    data.edges.rows[0].to = "missing";
    const snapshot = JSON.stringify(data);
    expect(() => {
      current = load(data);
    }).toThrow();
    expect(current).toBe(committed);
    expect(JSON.stringify(data)).toBe(snapshot);
    data.edges.rows[0].to = "junction-1";
    current = load(data);
    expect(current).not.toBe(committed);
    expect(committed.name.en).toBe("Existing design");
    expect(current.provenance).toEqual({
      kind: "imported",
      source: "Local user tables; source filenames are not published",
      license: "User-defined",
    });
  });
});

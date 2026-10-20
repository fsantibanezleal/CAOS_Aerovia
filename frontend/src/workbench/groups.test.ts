import { describe, expect, it } from "vitest";
import { makeStateKey, MAX_PEER_TABS } from "@fasl-work/caos-app-shell";
import { DEFAULT_OPTIONS } from "../engine";
import type { Network, Options } from "../contracts";
import {
  GROUPS,
  MAX_SUBVIEWS,
  OLD_PAGES,
  groupById,
  subViewOf,
  type GroupId,
} from "./groups";
import { stateControls } from "./railState";

/** The tool pages of the six modes of Aerovia 0.03.000 (`const pages` of the old Workbench.tsx), as they were. */
const TODAY: Record<string, string[]> = {
  design: ["primary", "node", "airway", "inspect", "view"],
  flow: ["primary", "conditions", "equipment", "inspect", "view"],
  transport: ["primary", "schedule", "monitor", "ledger", "view"],
  operations: ["primary", "conditions", "equipment", "energy", "inspect", "view"],
  risk: ["primary", "conditions", "equipment", "inspect", "view"],
  models: ["primary", "conditions", "equipment", "inspect", "view"],
};

describe("the five question groups of the App (decision 1, 2026-10-20)", () => {
  it("are design, airflow, transport, uncertainty and models, in that order", () => {
    expect(GROUPS.map((g) => g.id)).toEqual([
      "design",
      "airflow",
      "transport",
      "uncertainty",
      "models",
    ]);
  });

  it("with the Context view make at most six peer views (ADR-0071 rule 5)", () => {
    expect(GROUPS.length + 1).toBeLessThanOrEqual(MAX_PEER_TABS);
  });

  it("hold at most six sub-views each, with unique ids, in both languages", () => {
    for (const g of GROUPS) {
      expect(g.subs.length, g.id).toBeGreaterThan(0);
      expect(g.subs.length, g.id).toBeLessThanOrEqual(MAX_SUBVIEWS);
      expect(new Set(g.subs.map((s) => s.id)).size, g.id).toBe(g.subs.length);
      expect(g.en && g.es, g.id).toBeTruthy();
      for (const s of g.subs) expect(s.en && s.es, `${g.id}/${s.id}`).toBeTruthy();
    }
  });
});

describe("the mapping of the old tool pages (nothing lost)", () => {
  it("lists every tool page of today's six modes", () => {
    const total = Object.values(TODAY).reduce((n, pages) => n + pages.length, 0);
    expect(total).toBe(31);
    expect(OLD_PAGES).toHaveLength(total);
    for (const [mode, pages] of Object.entries(TODAY))
      expect(
        OLD_PAGES.filter((p) => p.mode === mode).map((p) => p.page),
        mode,
      ).toEqual(pages);
  });

  it("lands every old tool page in exactly one sub-view that exists", () => {
    for (const [mode, pages] of Object.entries(TODAY))
      for (const page of pages) {
        const hits = OLD_PAGES.filter((p) => p.mode === mode && p.page === page);
        expect(hits, `${mode}/${page}`).toHaveLength(1);
        const { group, sub } = subViewOf(mode, page)!;
        expect(
          groupById(group as GroupId)?.subs.some((s) => s.id === sub),
          `${mode}/${page} -> ${group}/${sub}`,
        ).toBe(true);
      }
  });

  it("merges the flow and operations modes into the airflow group", () => {
    for (const mode of ["flow", "operations"])
      for (const page of TODAY[mode])
        expect(subViewOf(mode, page)!.group, `${mode}/${page}`).toBe("airflow");
    expect(subViewOf("design", "primary")!.group).toBe("design");
    expect(subViewOf("transport", "monitor")!.group).toBe("transport");
    expect(subViewOf("risk", "primary")!.group).toBe("uncertainty");
    expect(subViewOf("models", "primary")!.group).toBe("models");
  });

  it("leaves no sub-view without an old tool page behind it", () => {
    for (const g of GROUPS)
      for (const s of g.subs)
        expect(
          OLD_PAGES.some((p) => p.group === g.id && p.sub === s.id),
          `${g.id}/${s.id}`,
        ).toBe(true);
  });

  it("returns nothing for a page that never existed", () => {
    expect(subViewOf("design", "nowhere")).toBeUndefined();
    expect(subViewOf("nowhere", "primary")).toBeUndefined();
  });
});

const net = (): Network => ({
  schema: "aerovia.network/v1",
  id: "k",
  name: { en: "k", es: "k" },
  description: { en: "k", es: "k" },
  provenance: { kind: "authored", source: "test", license: "Apache-2.0" },
  nodes: [
    { id: "a", x: 0, y: 0, z: 0, boundary: 0 },
    { id: "b", x: 10, y: 0, z: 0, boundary: 0 },
  ],
  edges: [
    {
      id: "ab",
      from: "a",
      to: "b",
      name: { en: "ab", es: "ab" },
      kind: "fan",
      area: 10,
      resistance: 1,
      target: 0,
      level: 0,
      fan: { pressure: 100, coefficient: 0, efficiency: 0.8 },
    },
  ],
});
const key = (network: Network, options: Options, variant?: string) =>
  makeStateKey({
    caseId: network.id,
    variantId: variant ?? null,
    source: null,
    controls: stateControls(network, options),
  });

describe("the state key (S10) moves with every operating control of the rail", () => {
  const base = key(net(), DEFAULT_OPTIONS);

  it("is the same for the same inputs", () => {
    expect(key(net(), structuredClone(DEFAULT_OPTIONS))).toBe(base);
  });

  it("moves with the fan speed", () => {
    expect(key(net(), { ...DEFAULT_OPTIONS, speed: 0.8 })).not.toBe(base);
  });

  it("moves with the resistance scale", () => {
    expect(key(net(), { ...DEFAULT_OPTIONS, resistanceScale: 1.4 })).not.toBe(base);
  });

  it("moves with an airway closure and with an airway override", () => {
    const closed = { ...DEFAULT_OPTIONS, overrides: { ab: { closed: true } } };
    const wider = { ...DEFAULT_OPTIONS, overrides: { ab: { area: 12 } } };
    expect(key(net(), closed)).not.toBe(base);
    expect(key(net(), wider)).not.toBe(base);
    expect(key(net(), closed)).not.toBe(key(net(), wider));
  });

  it("moves with an edit of the design, not only of the options", () => {
    const moved = net();
    moved.nodes[1].x = 25;
    const bigger = net();
    bigger.edges[0].area = 11;
    expect(key(moved, DEFAULT_OPTIONS)).not.toBe(base);
    expect(key(bigger, DEFAULT_OPTIONS)).not.toBe(base);
  });

  it("is told apart from another case on the same options", () => {
    const other = net();
    other.id = "other";
    expect(key(other, DEFAULT_OPTIONS)).not.toBe(base);
  });
});

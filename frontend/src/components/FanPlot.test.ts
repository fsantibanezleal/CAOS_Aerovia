import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Network } from "../contracts";
import { DEFAULT_OPTIONS, solveNetwork } from "../engine";
import { fanCurveSamples, fanOperatingState } from "./FanPlot";

const cases: Network[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "../data/cases.json"), "utf-8"),
);
const example = () => structuredClone(cases[0]);

describe("supported fan visualization states", () => {
  it("does not display delivered pressure for a closed fan branch", () => {
    const network = example(),
      fan = network.edges.find((e) => e.fan)!;
    const options = {
      ...DEFAULT_OPTIONS,
      overrides: { [fan.id]: { closed: true } },
    };
    const result = solveNetwork(network, options);
    expect(result.converged).toBe(true);
    expect(fanOperatingState(network, options, result)).toEqual({
      kind: "all-closed",
    });
  });
  it("distinguishes a stopped single fan from multiple pressure sources", () => {
    const network = example(),
      options = { ...DEFAULT_OPTIONS, speed: 0 };
    const state = fanOperatingState(
      network,
      options,
      solveNetwork(network, options),
    );
    expect(state).toMatchObject({
      kind: "active",
      reason: "zero-speed",
      equivalent: false,
      flow: 0,
      pressure: 0,
      activeFans: 1,
    });
  });
  it("recognizes common nonzero pressure offsets as an equivalent-network case", () => {
    const network = example();
    network.nodes.forEach((node) => {
      if (node.boundary !== undefined) node.boundary = 500;
    });
    const state = fanOperatingState(
      network,
      DEFAULT_OPTIONS,
      solveNetwork(network, DEFAULT_OPTIONS),
    );
    expect(state).toMatchObject({
      kind: "active",
      reason: "equivalent",
      equivalent: true,
    });
  });
  it("does not infer a quadratic system curve from unequal imposed boundary pressures", () => {
    const network = example();
    network.nodes.find((node) => node.boundary !== undefined)!.boundary = 100;
    const state = fanOperatingState(
      network,
      DEFAULT_OPTIONS,
      solveNetwork(network, DEFAULT_OPTIONS),
    );
    expect(state).toMatchObject({
      kind: "active",
      reason: "boundary-pressure",
      equivalent: false,
    });
  });
  it("identifies an actual multiple-fan case", () => {
    const network = cases.find((n) => n.id === "deep-booster")!;
    expect(
      fanOperatingState(
        network,
        DEFAULT_OPTIONS,
        solveNetwork(network, DEFAULT_OPTIONS),
      ),
    ).toMatchObject({ kind: "active", reason: "multiple-fans", activeFans: 2 });
  });
  it("cannot use a stale result with the wrong number of airways", () => {
    const network = example(),
      result = solveNetwork(network, DEFAULT_OPTIONS);
    expect(
      fanOperatingState(network, DEFAULT_OPTIONS, { ...result, flows: [1] }),
    ).toEqual({ kind: "unavailable" });
  });
  it("identifies a passive network without inventing a fan", () => {
    const network = example();
    network.edges.forEach((edge) => {
      if (edge.fan) {
        edge.kind = "return";
        delete edge.fan;
      }
    });
    expect(
      fanOperatingState(
        network,
        DEFAULT_OPTIONS,
        solveNetwork(network, DEFAULT_OPTIONS),
      ),
    ).toEqual({ kind: "no-fans" });
  });
  it("truncates a quadratic curve exactly at free delivery without a flat zero-head tail", () => {
    const fan = example().edges.find((edge) => edge.fan)!;
    const freeDelivery = Math.sqrt(fan.fan!.pressure / fan.fan!.coefficient);
    const points = fanCurveSamples(fan, 1, freeDelivery * 0.9);
    expect(points.at(-1)!.x).toBeCloseTo(freeDelivery, 10);
    expect(points.at(-1)!.y).toBeLessThan(1e-9);
    expect(points.slice(0, -1).every((point) => point.y > 0)).toBe(true);
    expect(points.every((point) => point.x <= freeDelivery)).toBe(true);
  });
  it("collapses a stopped quadratic fan domain to its zero-flow point", () => {
    const fan = example().edges.find((edge) => edge.fan)!;
    expect(
      fanCurveSamples(fan, 0, 0).every(
        (point) => point.x === 0 && point.y === 0,
      ),
    ).toBe(true);
  });
});

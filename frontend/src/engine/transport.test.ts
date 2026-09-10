import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Network, NetworkEdge, SolveOptions } from "../contracts";
import { DEFAULT_OPTIONS } from "./solver";
import {
  simulateTransport,
  solveFlowTimeline,
  type TransportOptions,
  type TransportResult,
} from "./transport";

const label = (en: string) => ({ en, es: en });
const edge = (
  id: string,
  from: string,
  to: string,
  resistance = 1,
): NetworkEdge => ({
  id,
  from,
  to,
  name: label(id),
  kind: "working",
  area: 10,
  resistance,
  target: 0,
  level: 0,
});
function single(): Network {
  return {
    schema: "aerovia.network/v1",
    id: "transport-test",
    name: label("Analytical tracer fixture"),
    description: label("Authored analytical network"),
    provenance: {
      kind: "authored",
      source: "Analytical test",
      license: "Apache-2.0",
    },
    nodes: [
      { id: "a", x: 0, y: 0, z: 0, boundary: 100 },
      { id: "b", x: 10, y: 0, z: 0, boundary: 0 },
    ],
    edges: [edge("ab", "a", "b")],
  };
}
const pulse: TransportOptions = {
  durationSeconds: 20,
  frameCount: 21,
  cellsPerEdge: 1,
  releases: [{ kind: "pulse", edgeId: "ab", startSeconds: 0, massMg: 1000 }],
};
const run = (
  network = single(),
  request: TransportOptions = pulse,
  options: SolveOptions = DEFAULT_OPTIONS,
) => simulateTransport(network, options, request);
function assertLedger(result: TransportResult): void {
  expect(result.completed, result.message).toBe(true);
  for (const frame of result.frames) {
    const scale = Math.max(1, frame.injectedMassMg);
    expect(Math.abs(frame.massBalanceErrorMg) / scale).toBeLessThan(1e-11);
    expect(
      frame.storedMassMg + frame.escapedMassMg + frame.removedMassMg,
    ).toBeCloseTo(frame.injectedMassMg, 6);
    expect(
      frame.cellConcentrations
        .flat()
        .every((value) => Number.isFinite(value) && value >= 0),
    ).toBe(true);
    expect(
      frame.nodeConcentrations.every(
        (value) => Number.isFinite(value) && value >= 0,
      ),
    ).toBe(true);
  }
}

describe("conservative passive tracer analytical solutions", () => {
  it("matches one mixed volume exponential washout and independently closes the ledger", () => {
    const result = run(single(), { ...pulse, maxStepSeconds: 0.02 });
    assertLedger(result);
    expect(result.edgeVolumes).toEqual([100]);
    for (const frame of result.frames) {
      expect(frame.concentrations[0]).toBeCloseTo(
        10 * Math.exp(-frame.timeSeconds / 10),
        5,
      );
      expect(frame.escapedMassMg).toBeCloseTo(
        1000 * (1 - Math.exp(-frame.timeSeconds / 10)),
        3,
      );
    }
  });
  it("converges at second order in time against the exact mixed-volume solution", () => {
    const error = (dt: number) =>
      Math.abs(
        run(single(), { ...pulse, frameCount: 2, maxStepSeconds: dt }).frames[1]
          .concentrations[0] -
          10 * Math.exp(-2),
      );
    expect(error(0.4) / error(0.2)).toBeGreaterThan(3.9);
    expect(error(0.4) / error(0.2)).toBeLessThan(4.2);
  });
  it("matches the independent Erlang survival expression for four airway cells", () => {
    const result = run(single(), {
      ...pulse,
      cellsPerEdge: 4,
      maxStepSeconds: 0.005,
      releases: [{ ...pulse.releases[0], position: 0 }],
    });
    assertLedger(result);
    for (const frame of result.frames) {
      const x = 0.4 * frame.timeSeconds;
      const survival = Math.exp(-x) * (1 + x + (x * x) / 2 + x ** 3 / 6);
      expect(frame.storedMassMg / 1000).toBeCloseTo(survival, 6);
    }
  });
  it("integrates finite continuous release and subsequent washout without extending the source", () => {
    const result = run(single(), {
      ...pulse,
      maxStepSeconds: 0.01,
      releases: [
        {
          kind: "continuous",
          edgeId: "ab",
          startSeconds: 0,
          durationSeconds: 10,
          rateMgPerSecond: 10,
        },
      ],
    });
    assertLedger(result);
    expect(result.frames[10].concentrations[0]).toBeCloseTo(
      1 - Math.exp(-1),
      6,
    );
    expect(result.frames[20].concentrations[0]).toBeCloseTo(
      (1 - Math.exp(-1)) * Math.exp(-1),
      6,
    );
    expect(result.frames[20].injectedMassMg).toBeCloseTo(100, 8);
  });
  it("combines advection and first-order loss with independently known competing fractions", () => {
    const result = run(single(), {
      ...pulse,
      decayPerSecond: 0.2,
      maxStepSeconds: 0.005,
    });
    assertLedger(result);
    const final = result.frames.at(-1)!;
    expect(final.storedMassMg).toBeCloseTo(1000 * Math.exp(-6), 4);
    expect(final.escapedMassMg).toBeCloseTo((1000 / 3) * (1 - Math.exp(-6)), 4);
    expect(final.removedMassMg).toBeCloseTo((2000 / 3) * (1 - Math.exp(-6)), 4);
  });
  it("retains trapped mass in a closed branch and accounts for decay with zero airflow", () => {
    const closed = { ...DEFAULT_OPTIONS, overrides: { ab: { closed: true } } };
    const staticResult = run(single(), pulse, closed);
    assertLedger(staticResult);
    expect(
      staticResult.frames.every(
        (frame) => frame.storedMassMg === 1000 && frame.escapedMassMg === 0,
      ),
    ).toBe(true);
    const result = run(
      single(),
      { ...pulse, decayPerSecond: 0.1, maxStepSeconds: 0.01 },
      closed,
    );
    assertLedger(result);
    expect(result.frames.at(-1)!.storedMassMg).toBeCloseTo(
      1000 * Math.exp(-2),
      4,
    );
    expect(result.frames.at(-1)!.escapedMassMg).toBe(0);
  });
});

describe("transport direction, mixing and scheduled events", () => {
  it("is physically identical under edge reversal with the source position mapped", () => {
    const forward = single();
    const reverse = single();
    reverse.edges[0] = { ...reverse.edges[0], from: "b", to: "a" };
    const a = run(forward, {
      ...pulse,
      cellsPerEdge: 6,
      releases: [{ ...pulse.releases[0], position: 0.2 }],
    });
    const b = run(reverse, {
      ...pulse,
      cellsPerEdge: 6,
      releases: [{ ...pulse.releases[0], position: 0.8 }],
    });
    assertLedger(a);
    assertLedger(b);
    a.frames.forEach((frame, i) => {
      expect(b.frames[i].escapedMassMg).toBeCloseTo(frame.escapedMassMg, 9);
      expect([...b.frames[i].cellConcentrations[0]].reverse()).toEqual(
        frame.cellConcentrations[0],
      );
    });
  });
  it("places a source on a cell interface symmetrically under orientation reversal", () => {
    const network = single();
    const forward = run(network, { ...pulse, cellsPerEdge: 6 });
    network.edges[0] = { ...network.edges[0], from: "b", to: "a" };
    const reverse = run(network, { ...pulse, cellsPerEdge: 6 });
    forward.frames.forEach((frame, i) =>
      expect([...reverse.frames[i].cellConcentrations[0]].reverse()).toEqual(
        frame.cellConcentrations[0],
      ),
    );
    expect(
      forward.frames[0].cellConcentrations[0].filter((value) => value > 0),
    ).toHaveLength(2);
  });
  it("mixes incoming flux at an internal junction without duplicating tracer", () => {
    const network = single();
    network.nodes = [
      { id: "a", x: 0, y: 10, z: 0, boundary: 200 },
      { id: "b", x: 0, y: -10, z: 0, boundary: 200 },
      { id: "m", x: 10, y: 0, z: 0 },
      { id: "c", x: 20, y: 0, z: 0, boundary: 0 },
    ];
    network.edges = [
      edge("am", "a", "m"),
      edge("bm", "b", "m"),
      edge("mc", "m", "c", 0.25),
    ];
    const result = run(network, {
      durationSeconds: 300,
      cellsPerEdge: 2,
      frameCount: 11,
      releases: [
        {
          kind: "continuous",
          edgeId: "am",
          position: 0,
          startSeconds: 0,
          durationSeconds: 300,
          rateMgPerSecond: 10,
        },
      ],
    });
    assertLedger(result);
    const last = result.frames.at(-1)!;
    expect(result.flowStates[0].result.flows[0]).toBeCloseTo(10, 6);
    expect(last.concentrations[0]).toBeCloseTo(1, 6);
    expect(last.concentrations[1]).toBe(0);
    expect(last.concentrations[2]).toBeCloseTo(0.5, 6);
    expect(last.nodeConcentrations[2]).toBeCloseTo(0.5, 6);
  });
  it("splits outgoing tracer flux according to actual airflow", () => {
    const network = single();
    network.nodes = [
      { id: "a", x: 0, y: 0, z: 0, boundary: 100 },
      { id: "m", x: 10, y: 0, z: 0 },
      { id: "b", x: 20, y: 5, z: 0, boundary: 0 },
      { id: "c", x: 20, y: -5, z: 0, boundary: 0 },
    ];
    network.edges = [
      edge("am", "a", "m"),
      edge("mb", "m", "b"),
      edge("mc", "m", "c", 4),
    ];
    const result = run(network, {
      durationSeconds: 1000,
      frameCount: 11,
      cellsPerEdge: 1,
      releases: [
        {
          kind: "continuous",
          edgeId: "am",
          startSeconds: 0,
          durationSeconds: 1000,
          rateMgPerSecond: 10,
        },
      ],
    });
    assertLedger(result);
    const q = result.flowStates[0].result.flows;
    expect(q[1] / q[2]).toBeCloseTo(2, 7);
    const last = result.frames.at(-1)!;
    expect(last.concentrations[1]).toBeCloseTo(last.concentrations[2], 8);
    expect(last.concentrations[1]).toBeCloseTo(10 / q[0], 7);
  });
  it("exports incoming tracer at a pressure boundary rather than recycling it into outgoing air", () => {
    const network = single();
    network.nodes.push({ id: "c", x: 20, y: 0, z: 0, boundary: -100 });
    network.edges.push(edge("bc", "b", "c"));
    const result = run(network, { ...pulse, durationSeconds: 100 });
    assertLedger(result);
    expect(
      result.frames.every(
        (frame) =>
          frame.concentrations[1] === 0 && frame.nodeConcentrations[1] === 0,
      ),
    ).toBe(true);
    expect(result.frames.at(-1)!.escapedMassMg).toBeGreaterThan(999);
  });
  it("aligns a pulse exactly to an output time and does not smear its injection", () => {
    const result = run(single(), {
      ...pulse,
      frameCount: 3,
      releases: [{ ...pulse.releases[0], startSeconds: 10 }],
    });
    assertLedger(result);
    expect(result.frames[0].injectedMassMg).toBe(0);
    expect(result.frames[1].timeSeconds).toBe(10);
    expect(result.frames[1].storedMassMg).toBe(1000);
    expect(result.frames[1].escapedMassMg).toBe(0);
    expect(result.frames[2].storedMassMg).toBeLessThan(1000);
  });
  it("retains tracer while closed and resumes transport at the exact reopening event", () => {
    const closed = { ...DEFAULT_OPTIONS, overrides: { ab: { closed: true } } };
    const result = run(single(), {
      ...pulse,
      maxStepSeconds: 0.005,
      schedule: [
        { timeSeconds: 5, options: closed },
        { timeSeconds: 15, options: DEFAULT_OPTIONS },
      ],
    });
    assertLedger(result);
    expect(result.frames[5].flowStateIndex).toBe(1);
    expect(result.frames[15].flowStateIndex).toBe(2);
    expect(result.frames[5].storedMassMg).toBe(result.frames[15].storedMassMg);
    expect(result.frames.at(-1)!.storedMassMg).toBeCloseTo(
      1000 * Math.exp(-1),
      4,
    );
  });
  it("changes common fan speed without resetting the concentration field", () => {
    const network = single();
    network.nodes[0].boundary = 0;
    network.edges[0] = {
      ...network.edges[0],
      kind: "fan",
      fan: { pressure: 100, coefficient: 0, efficiency: 0.8 },
    };
    const result = run(network, {
      ...pulse,
      maxStepSeconds: 0.01,
      schedule: [
        { timeSeconds: 10, options: { ...DEFAULT_OPTIONS, speed: 0.5 } },
      ],
    });
    assertLedger(result);
    expect(result.flowStates[1].result.flows[0]).toBeCloseTo(5, 10);
    expect(result.frames.at(-1)!.storedMassMg).toBeCloseTo(
      1000 * Math.exp(-1.5),
      4,
    );
  });
  it("preserves the physical cell coordinates when a scheduled resistance change reverses a crosscut", () => {
    const network = single();
    network.nodes.push(
      { id: "u", x: 5, y: 5, z: 0 },
      { id: "v", x: 5, y: -5, z: 0 },
    );
    network.edges = [
      edge("au", "a", "u"),
      edge("ub", "u", "b", 4),
      edge("av", "a", "v", 4),
      edge("vb", "v", "b"),
      edge("uv", "u", "v"),
    ];
    const reversed = {
      ...DEFAULT_OPTIONS,
      overrides: {
        au: { resistance: 4 },
        ub: { resistance: 1 },
        av: { resistance: 1 },
        vb: { resistance: 4 },
      },
    };
    const request: TransportOptions = {
      durationSeconds: 10,
      cellsPerEdge: 6,
      frameCount: 11,
      schedule: [{ timeSeconds: 5, options: reversed }],
      releases: [
        {
          kind: "pulse",
          edgeId: "uv",
          startSeconds: 0,
          position: 0.5,
          massMg: 1000,
        },
      ],
    };
    const a = run(network, request);
    assertLedger(a);
    expect(a.flowStates[0].result.flows[4]).toBeGreaterThan(0);
    expect(a.flowStates[1].result.flows[4]).toBeLessThan(0);
    const mirrored = structuredClone(network);
    mirrored.edges[4] = { ...mirrored.edges[4], from: "v", to: "u" };
    const b = run(mirrored, request);
    assertLedger(b);
    a.frames.forEach((frame, i) => {
      expect(b.frames[i].storedMassMg).toBeCloseTo(frame.storedMassMg, 8);
      expect([...b.frames[i].cellConcentrations[4]].reverse()).toEqual(
        frame.cellConcentrations[4],
      );
    });
  });
});

describe("transport validation and bounded computation", () => {
  it("rejects invalid source references, dimensions, ranges and late events", () => {
    const bad: TransportOptions[] = [
      { ...pulse, releases: [{ ...pulse.releases[0], edgeId: "missing" }] },
      { ...pulse, releases: [{ ...pulse.releases[0], position: 1.01 }] },
      { ...pulse, releases: [{ ...pulse.releases[0], startSeconds: -1 }] },
      { ...pulse, durationSeconds: Infinity },
      { ...pulse, cellsPerEdge: 17 },
      { ...pulse, cellsPerEdge: 1.5 },
      { ...pulse, frameCount: 302 },
      { ...pulse, decayPerSecond: -1 },
      { ...pulse, maxStepSeconds: 0 },
      {
        ...pulse,
        releases: [
          { kind: "pulse", edgeId: "ab", startSeconds: 0, massMg: NaN },
        ],
      },
      {
        ...pulse,
        releases: [
          {
            kind: "continuous",
            edgeId: "ab",
            startSeconds: 10,
            durationSeconds: 20,
            rateMgPerSecond: 1,
          },
        ],
      },
      { ...pulse, schedule: [{ timeSeconds: 21, options: DEFAULT_OPTIONS }] },
    ];
    for (const request of bad) expect(() => run(single(), request)).toThrow();
  });
  it("rejects volume-changing schedules and ambiguous simultaneous operating states", () => {
    expect(() =>
      solveFlowTimeline(single(), DEFAULT_OPTIONS, [
        {
          timeSeconds: 1,
          options: { ...DEFAULT_OPTIONS, overrides: { ab: { area: 20 } } },
        },
      ]),
    ).toThrow(/fixed airway volumes/);
    expect(() =>
      solveFlowTimeline(single(), DEFAULT_OPTIONS, [
        { timeSeconds: 1, options: DEFAULT_OPTIONS },
        { timeSeconds: 1, options: DEFAULT_OPTIONS },
      ]),
    ).toThrow(/distinct/);
    expect(() =>
      solveFlowTimeline(single(), DEFAULT_OPTIONS, [
        { timeSeconds: 0, options: DEFAULT_OPTIONS },
      ]),
    ).toThrow();
  });
  it("accepts unsorted events as complete options while preserving the supplied objects", () => {
    const request = {
      ...pulse,
      schedule: [
        { timeSeconds: 10, options: DEFAULT_OPTIONS },
        { timeSeconds: 5, options: { ...DEFAULT_OPTIONS, resistanceScale: 2 } },
      ],
    };
    const before = JSON.stringify(request);
    const result = run(single(), request);
    expect(result.flowStates.map((state) => state.timeSeconds)).toEqual([
      0, 5, 10,
    ]);
    expect(JSON.stringify(request)).toBe(before);
  });
  it("refuses unsupported disconnected airflow instead of generating a fabricated concentration", () => {
    const network = single();
    network.nodes.push({ id: "dead", x: 0, y: 10, z: 0 });
    network.edges.push(edge("dead-end", "a", "dead"));
    const result = run(network, pulse, {
      ...DEFAULT_OPTIONS,
      overrides: { "dead-end": { closed: true } },
    });
    expect(result.completed).toBe(false);
    expect(result.message).toMatch(/isolate/);
    expect(result.frames).toEqual([]);
  });
  it("rejects excessive integration work before stepping instead of silently changing inputs", () => {
    expect(() =>
      run(single(), {
        ...pulse,
        durationSeconds: 86400,
        cellsPerEdge: 16,
        maxStepSeconds: 1e-5,
      }),
    ).toThrow(/integration budget/);
  });
  it("requires a length for coincident endpoints and reports explicit lengths and volumes", () => {
    const network = single();
    network.nodes[1].x = 0;
    expect(() => run(network)).toThrow(/zero geometric length/);
    const result = run(network, { ...pulse, edgeLengths: { ab: 50 } });
    expect(result.edgeLengths).toEqual([50]);
    expect(result.edgeVolumes).toEqual([500]);
  });
  it("supports an empty source list and serializable finite outputs", () => {
    const result = run(single(), { ...pulse, releases: [] });
    assertLedger(result);
    expect(result.frames.every((frame) => frame.storedMassMg === 0)).toBe(true);
    expect(JSON.parse(JSON.stringify(result)).frames).toEqual(result.frames);
  });
  const catalog = JSON.parse(
    readFileSync(new URL("../../../data/cases.json", import.meta.url), "utf8"),
  ) as Network[];
  it.each(catalog.map((network) => [network.id, network] as const))(
    "conserves tracer on the authored %s network",
    (_id, network) => {
      const result = run(network, {
        durationSeconds: 600,
        frameCount: 31,
        cellsPerEdge: 6,
        releases: [
          {
            kind: "pulse",
            edgeId: network.edges[0].id,
            startSeconds: 0,
            massMg: 1000,
          },
        ],
      });
      assertLedger(result);
      expect(result.frames).toHaveLength(31);
      expect(result.frames.at(-1)!.escapedMassMg).toBeGreaterThan(0);
    },
  );
});

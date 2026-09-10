import { test } from "./helpers";
import { expect } from "@playwright/test";
import {
  analyticalNetwork,
  balanced,
  defaults,
  downloaded,
  importProject,
  mode,
  toolSection,
  modelSection,
  numeric,
  openWorkbench,
  project,
  uiNumber,
} from "./helpers";
import {
  simulateTransport,
  type TransportOptions,
  type TransportResult,
} from "../src/engine/transport";
import type { Network, Options } from "../src/contracts";

test.use({ locale: "en-US", actionTimeout: 10000 });
async function transportExport(page: import("@playwright/test").Page) {
  await toolSection(page, "ledger");
  await expect(
    page.getByRole("heading", { name: "Mass balance", exact: true }),
  ).toBeVisible();
  const record = await downloaded<{
    schema: string;
    network: Network;
    options: Options;
    request: TransportOptions;
    result: TransportResult;
  }>(page, "Export time series");
  expect(record.schema).toBe("aerovia.transport-replay/v1");
  const current = await project(page);
  expect(record.network).toEqual(current.network);
  expect(record.options).toEqual(current.options);
  const replay = simulateTransport(
    record.network,
    record.options,
    record.request,
  );
  expect(replay.frames).toEqual(record.result.frames);
  await toolSection(page, "monitor");
  return record.result;
}
async function prepareTracer(page: import("@playwright/test").Page) {
  await openWorkbench(page);
  await importProject(page, analyticalNetwork());
  await mode(page, "Tracer transport");
  await numeric(page, "Total tracer", 1000);
  await numeric(page, "Simulation", 20);
}
function ledger(result: TransportResult) {
  expect(result.completed, result.message).toBe(true);
  expect(result.frames).toHaveLength(151);
  for (const frame of result.frames) {
    expect(Math.abs(frame.massBalanceErrorMg)).toBeLessThan(1e-7);
    expect(
      frame.storedMassMg + frame.escapedMassMg + frame.removedMassMg,
    ).toBeCloseTo(frame.injectedMassMg, 6);
    expect(
      frame.cellConcentrations
        .flat()
        .every((value) => Number.isFinite(value) && value >= 0),
    ).toBe(true);
  }
}

test("a real worker pulse evolves, scrubs and exports a conservative spatial concentration history", async ({
  page,
}) => {
  await prepareTracer(page);
  await toolSection(page, "primary");
  await page
    .getByRole("button", { name: "Simulate transport", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Simulation time", exact: true }),
  ).toBeEnabled();
  const result = await transportExport(page);
  ledger(result);
  expect(result.flowStates[0].result.flows[0]).toBeCloseTo(10, 8);
  expect(result.frames[0].storedMassMg).toBe(1000);
  expect(result.frames.at(-1)!.escapedMassMg).toBeGreaterThan(999);
  await page
    .getByRole("slider", { name: "Simulation time", exact: true })
    .fill("75");
  await expect(page.locator(".av-timeline output")).toHaveText("10 s");
  await toolSection(page, "ledger");
  const stored = page
    .locator(".av-ledger > div")
    .filter({ has: page.getByText("In mine", { exact: true }) })
    .locator("strong");
  expect(uiNumber(await stored.innerText())).toBeCloseTo(
    result.frames[75].storedMassMg,
    3,
  );
  await toolSection(page, "monitor");
  await expect(
    page.getByRole("img", { name: /Monitor: Analytical fan airway/ }),
  ).toBeVisible();
  await page
    .getByRole("slider", { name: "Simulation time", exact: true })
    .fill("0");
  await page
    .getByRole("button", { name: "Play transport", exact: true })
    .click();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("slider", { name: "Simulation time", exact: true })
          .inputValue(),
      ),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Pause transport", exact: true })
    .click();
  const stopped = await page
    .getByRole("slider", { name: "Simulation time", exact: true })
    .inputValue();
  await page.waitForTimeout(150);
  await expect(
    page.getByRole("slider", { name: "Simulation time", exact: true }),
  ).toHaveValue(stopped);
  await toolSection(page, "primary");
  await numeric(page, "Total tracer", 2000);
  await toolSection(page, "monitor");
  await expect(
    page.getByRole("slider", { name: "Simulation time", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Export time series", exact: true }),
  ).toHaveCount(0);
  await toolSection(page, "primary");
  await page
    .getByRole("button", { name: "Simulate transport", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Simulation time", exact: true }),
  ).toBeEnabled();
  const doubled = await transportExport(page);
  expect(doubled.frames[75].storedMassMg).toBeCloseTo(
    2 * result.frames[75].storedMassMg,
    7,
  );
});

test("a scheduled fan stop preserves the trapped field and the displayed flow belongs to the selected time", async ({
  page,
}) => {
  await prepareTracer(page);
  await toolSection(page, "schedule");
  await page
    .getByRole("checkbox", {
      name: "Schedule a ventilation change",
      exact: true,
    })
    .check();
  await numeric(page, "Change at", 2);
  await numeric(page, "New fan speed", 0);
  await toolSection(page, "primary");
  await page
    .getByRole("button", { name: "Simulate transport", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Simulation time", exact: true }),
  ).toBeEnabled();
  const result = await transportExport(page);
  ledger(result);
  expect(result.flowStates.map((state) => state.timeSeconds)).toEqual([0, 2]);
  expect(result.flowStates[1].result.flows[0]).toBe(0);
  expect(result.frames.at(-1)!.storedMassMg).toBeGreaterThan(500);
  expect(result.frames.at(-1)!.storedMassMg).toBeCloseTo(
    result.frames[15].storedMassMg,
    8,
  );
  await page
    .getByRole("slider", { name: "Simulation time", exact: true })
    .fill("150");
  await expect(page.locator(".av-viz-readout > strong")).toHaveText("0 m³/s");
  await page
    .getByRole("slider", { name: "Simulation time", exact: true })
    .fill("0");
  await expect(page.locator(".av-viz-readout > strong")).toHaveText("10 m³/s");
});

test("a continuous source has its exact finite mass and an impossible release interval returns a repairable error", async ({
  page,
}) => {
  await prepareTracer(page);
  await page
    .getByRole("combobox", { name: /^Release type/ })
    .selectOption("continuous");
  await numeric(page, "Release duration", 10);
  await numeric(page, "Start time", 2);
  await toolSection(page, "primary");
  await page
    .getByRole("button", { name: "Simulate transport", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Simulation time", exact: true }),
  ).toBeEnabled();
  const result = await transportExport(page);
  ledger(result);
  expect(result.frames[0].injectedMassMg).toBe(0);
  expect(result.frames.at(-1)!.injectedMassMg).toBeCloseTo(1000, 7);
  const original = await project(page);
  await toolSection(page, "primary");
  await numeric(page, "Start time", 18);
  await toolSection(page, "primary");
  await page
    .getByRole("button", { name: "Simulate transport", exact: true })
    .click();
  await expect(page.locator(".av-controls").getByRole("alert")).toContainText(
    "ends after the simulation",
  );
  await expect(
    page.getByRole("button", { name: "Export time series", exact: true }),
  ).toHaveCount(0);
  expect((await project(page)).network).toEqual(original.network);
});

test("directed air routes stop at external boundaries and expose a real nominal transit metric", async ({
  page,
}) => {
  await openWorkbench(page);
  const network = analyticalNetwork();
  network.nodes[0].boundary = 200;
  network.nodes[1].boundary = 100;
  network.nodes.push({ id: "c", x: 20, y: 0, z: 0, boundary: 0 });
  network.edges[0] = { ...network.edges[0], kind: "working" };
  delete network.edges[0].fan;
  network.edges.push({
    ...network.edges[0],
    id: "bc",
    from: "b",
    to: "c",
    name: { en: "Second boundary passage", es: "Segundo paso exterior" },
  });
  await importProject(page, network);
  await mode(page, "Airflow & paths");
  await page
    .getByRole("combobox", { name: "Analysis", exact: true })
    .selectOption("route");
  await page
    .getByRole("combobox", { name: /^Source junction/ })
    .selectOption("a");
  await page
    .getByRole("combobox", { name: /^Destination junction/ })
    .selectOption("c");
  await expect(page.locator(".av-controls")).toContainText(
    "No directed airflow path reaches this destination",
  );
  await page
    .getByRole("combobox", { name: /^Destination junction/ })
    .selectOption("b");
  await expect(page.locator(".av-ledger")).toContainText("10 s");
  await expect(page.locator(".av-ledger")).toContainText("10 m");
});

test("a search-method restriction does not falsely declare a feasible unequal-boundary network infeasible", async ({
  page,
}) => {
  await openWorkbench(page);
  const network = analyticalNetwork();
  network.nodes[0].boundary = 10;
  network.edges[0].target = 1;
  await importProject(page, network, { ...defaults, speed: 1.5 });
  await mode(page, "Fan operations");
  await expect(page.locator(".av-viz-readout")).toContainText(
    "0/1 targets short",
  );
  await page
    .getByRole("button", {
      name: "Find minimum speed meeting targets",
      exact: true,
    })
    .click();
  await expect(page.locator(".av-controls")).toContainText(
    "requires equal boundary pressures",
  );
  await expect(page.locator(".av-controls")).not.toContainText(
    /Targets not achievable|targets are infeasible/i,
  );
  await expect(
    page.getByRole("button", { name: "Apply operating point", exact: true }),
  ).toHaveCount(0);
  await balanced(page);
});

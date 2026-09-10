import { test } from "./helpers";
import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  analyticalNetwork,
  balanced,
  defaults,
  importProject,
  mode,
  toolSection,
  modelSection,
  numeric,
  openWorkbench,
  parameters,
  project,
  uiNumber,
} from "./helpers";
import type { Network } from "../src/contracts";

test.use({ locale: "en-US", actionTimeout: 10000 });

test("draw, connect, move, add a fan, split, undo and recover the actual edited project", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openWorkbench(page);
  await page.getByRole("button", { name: "New design", exact: true }).click();
  await page.getByLabel("Project name").fill("Browser authored mine");
  await page
    .getByRole("button", { name: "Create design", exact: true })
    .click();
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page
    .getByRole("combobox", { name: /^Junction/ })
    .selectOption("junction-1");
  await page
    .getByRole("combobox", { name: "Camera view", exact: true })
    .selectOption("plan");
  const canvas = page.locator("canvas"),
    bounds = (await canvas.boundingBox())!;
  await canvas.click({
    position: { x: bounds.width * 0.7, y: bounds.height * 0.35 },
  });
  await expect(page.getByRole("combobox", { name: /^Junction/ })).toHaveValue(
    "junction-2",
  );
  const drawn = await project(page);
  expect(drawn.network.nodes).toHaveLength(3);
  expect(drawn.network.edges).toHaveLength(2);
  const created = drawn.network.nodes.find((node) => node.id === "junction-2")!;
  expect(Math.hypot(created.x, created.y)).toBeGreaterThan(0);
  expect(created.z).toBe(-30);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page
    .getByRole("combobox", { name: /^Junction/ })
    .selectOption("surface");
  await expect
    .poll(async () => (await project(page)).network.edges.length)
    .toBe(3);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page
    .getByRole("combobox", { name: /^Junction/ })
    .selectOption("junction-2");
  await toolSection(page, "node");
  await numeric(page, "X · m", created.x + 10);
  const moved = await project(page);
  expect(moved.network.nodes.find((node) => node.id === "junction-2")!.x).toBe(
    created.x + 10,
  );
  await toolSection(page, "airway");
  await page.getByRole("button", { name: "Fan", exact: true }).click();
  await balanced(page);
  expect(
    (await project(page)).network.edges.filter((edge) => edge.fan),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Split", exact: true }).click();
  const split = await project(page);
  expect(split.network.nodes).toHaveLength(4);
  expect(split.network.edges).toHaveLength(4);
  expect(split.network.edges.filter((edge) => edge.fan)).toHaveLength(1);
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  expect((await project(page)).network.edges).toHaveLength(3);
  await page.getByRole("button", { name: "Redo edit", exact: true }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => localStorage.getItem("aerovia.project.v1")),
    )
    .toContain("junction-3");
  await page.reload();
  await balanced(page);
  const recovered = await project(page);
  expect(recovered.network).toEqual(split.network);
  expect(recovered.options).toEqual(split.options);
  expect(errors).toEqual([]);
});

test("pointer orbit changes the projection and an axis drag commits a real node coordinate", async ({
  page,
}) => {
  await openWorkbench(page);
  const network = analyticalNetwork();
  network.nodes[1].x = 100;
  network.edges[0].area = 1;
  await importProject(page, network);
  await toolSection(page, "view");
  await page.getByRole("checkbox", { name: "Labels", exact: true }).check();
  const canvas = page.locator("canvas"),
    box = (await canvas.boundingBox())!;
  const node = page.getByRole("button", { name: "Junction b", exact: true });
  const beforeOrbit = await node.evaluate((element) => ({
    x: element.style.left,
    y: element.style.top,
  }));
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.6, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(() =>
      node.evaluate((element) => ({
        x: element.style.left,
        y: element.style.top,
      })),
    )
    .not.toEqual(beforeOrbit);
  expect((await project(page)).network.nodes).toEqual(network.nodes);
  await page
    .getByRole("combobox", { name: "Camera view", exact: true })
    .selectOption("plan");
  await toolSection(page, "primary");
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await page.getByRole("combobox", { name: /^Junction/ }).selectOption("b");
  const point = await node.evaluate((element) => ({
    x: Number.parseFloat(element.style.left),
    y: Number.parseFloat(element.style.top),
  }));
  await page.mouse.move(box.x + point.x + 30, box.y + point.y);
  await page.mouse.down();
  await page.mouse.move(box.x + point.x + 100, box.y + point.y, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () => (await project(page)).network.nodes[1])
    .not.toEqual(network.nodes[1]);
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  expect((await project(page)).network.nodes).toEqual(network.nodes);
});

test("flow controls change actual flow and power and closure has a recoverable model consequence", async ({
  page,
}) => {
  await openWorkbench(page);
  await importProject(page, analyticalNetwork());
  await mode(page, "Airflow & paths");
  const intake = () =>
    page.locator(".av-viz-readout > strong").innerText().then(uiNumber);
  expect(await intake()).toBeCloseTo(10, 2);
  await toolSection(page, "conditions");
  await page
    .getByRole("slider", { name: "Fan speed", exact: true })
    .fill("0.5");
  await expect.poll(intake).toBeCloseTo(5, 2);
  await expect(page.locator(".av-viz-readout")).toContainText("0.16 kW");
  await toolSection(page, "equipment");
  await page
    .getByRole("checkbox", { name: "Close this airway", exact: true })
    .check();
  await expect.poll(intake).toBe(0);
  expect((await project(page)).options.overrides.ab.closed).toBe(true);
  await toolSection(page, "equipment");
  await page
    .getByRole("checkbox", { name: "Close this airway", exact: true })
    .uncheck();
  await expect.poll(intake).toBeCloseTo(5, 2);
});

test("JSON imports preserve current inputs on failure and round-trip an edited operating state", async ({
  page,
}) => {
  await openWorkbench(page);
  await mode(page, "Airflow & paths");
  await toolSection(page, "conditions");
  await page
    .getByRole("slider", { name: "Fan speed", exact: true })
    .fill("0.83");
  const original = await project(page);
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByLabel(/Saved project or network JSON/).setInputFiles({
    name: "malformed.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schema":"invalid"}'),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const unchanged = await project(page);
  expect(unchanged.network).toEqual(original.network);
  expect(unchanged.options).toEqual(original.options);
  await importProject(page, analyticalNetwork());
  await importProject(page, original.network, original.options);
  const roundTrip = await project(page);
  expect(roundTrip.network).toEqual(original.network);
  expect(roundTrip.options).toEqual(original.options);
});

test("two CSV uploads map units and languages, while malformed joins leave the current design intact", async ({
  page,
}) => {
  await openWorkbench(page);
  const before = await project(page);
  const nodes =
    'Node ID,Easting,Northing,Elevation,pressure_pa\n"surface-in",0,0,0,100\nend,100,0,-10,0';
  const good =
    'ID,Start,End,Area,R,nameEn,nameEs\na,"surface-in",end,100,0.2,"Intake, north","Entrada, norte"';
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByLabel("Junction CSV", { exact: true }).setInputFiles({
    name: "nodes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(nodes),
  });
  await page.getByLabel("Airway CSV", { exact: true }).setInputFiles({
    name: "edges.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(good.replace(",end,100", ",missing,100")),
  });
  await page
    .getByRole("combobox", { name: /^Geometry units/ })
    .selectOption("ft");
  await page
    .getByRole("button", { name: "Validate and load tables", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "unknown node",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect((await project(page)).network).toEqual(before.network);
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByLabel("Junction CSV", { exact: true }).setInputFiles({
    name: "nodes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(nodes),
  });
  await page.getByLabel("Airway CSV", { exact: true }).setInputFiles({
    name: "edges.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(good),
  });
  await page
    .getByRole("combobox", { name: /^Geometry units/ })
    .selectOption("ft");
  await page
    .getByRole("button", { name: "Validate and load tables", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await balanced(page);
  const imported = await project(page);
  expect(imported.network.nodes[1].x).toBeCloseTo(30.48, 8);
  expect(imported.network.edges[0].area).toBeCloseTo(9.290304, 8);
  expect(imported.network.edges[0].name).toEqual({
    en: "Intake, north",
    es: "Entrada, norte",
  });
  await page
    .getByRole("button", { name: "Network tables", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Airway CSV", exact: true }).click();
  const csv = await readFile((await (await pending).path())!, "utf8");
  expect(csv).toContain("nameEn,nameEs");
  expect(csv).toContain("Entrada, norte");
});

test("optimization, operating curve and sensitivity are calculated and applied through current controls", async ({
  page,
}) => {
  await openWorkbench(page);
  await mode(page, "Fan operations");
  await page
    .getByRole("button", {
      name: "Find minimum speed meeting targets",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply operating point", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Apply operating point", exact: true })
    .click();
  await balanced(page);
  expect((await project(page)).options.speed).not.toBe(1);
  await expect(page.locator(".av-viz-readout")).toContainText(
    "0/12 targets short",
  );
  await page
    .getByRole("button", { name: "Sweep the fan speed", exact: true })
    .click();
  await toolSection(page, "inspect");
  await expect(
    page.getByRole("img", { name: /Fan speed sweep/ }),
  ).toBeVisible();
  await toolSection(page, "primary");
  await page
    .getByRole("combobox", { name: /^Operating question/ })
    .selectOption("sensitivity");
  await page
    .getByRole("button", { name: "Rank resistance interventions", exact: true })
    .click();
  await toolSection(page, "inspect");
  await expect(page.locator(".av-sensitivity-bars button")).toHaveCount(8);
  const intervention = page.locator(".av-sensitivity-bars button").first();
  const selectedName = await intervention.locator("span").innerText();
  await intervention.click();
  await mode(page, "Airflow & paths");
  await toolSection(page, "inspect");
  await expect(page.locator(".av-selected-readout h3")).toHaveText(
    selectedName,
  );
});

test("all twelve authored cases remain selectable and solvable through rapid case changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cases = JSON.parse(
    await readFile(new URL("../../data/cases.json", import.meta.url), "utf8"),
  ) as Network[];
  await openWorkbench(page);
  for (const network of cases) {
    await page
      .getByRole("combobox", { name: "Network case", exact: true })
      .selectOption(network.id);
    await expect(page.locator(".av-instrument")).toContainText(network.name.en);
    await balanced(page);
    expect((await project(page)).network.id).toBe(network.id);
  }
  await page
    .getByRole("combobox", { name: "Network case", exact: true })
    .selectOption(cases[0].id);
  await page
    .getByRole("combobox", { name: "Network case", exact: true })
    .selectOption(cases[11].id);
  await balanced(page);
  expect(errors).toEqual([]);
});

test("recorded uncertainty selects an airway and disappears when the operating inputs no longer match", async ({
  page,
}) => {
  const catalog = JSON.parse(
    await readFile(
      new URL("../../data/artifacts/catalog.json", import.meta.url),
      "utf8",
    ),
  ) as { cases: Array<{ network: Network; ensemble: { flowP50: number[] } }> };
  await openWorkbench(page);
  const current = await project(page);
  const item = catalog.cases.find(
    (item) => item.network.id === current.network.id,
  )!;
  const lastIndex = item.network.edges.reduce(
    (last, edge, index) => (edge.target > 0 ? index : last),
    -1,
  );
  const last = item.network.edges[lastIndex];
  await mode(page, "Uncertainty");
  await toolSection(page, "inspect");
  const plot = page.getByRole("img", { name: /^Working-airway uncertainty/ });
  await expect(plot).toBeVisible();
  await expect(plot.locator("path")).toHaveCount(4);
  const box = (await plot.boundingBox())!;
  await plot.click({ position: { x: box.width - 14, y: box.height / 2 } });
  await expect(page.locator(".av-interval-readout h3")).toHaveText(
    last.name.en,
  );
  const median = page
    .locator(".av-interval-readout > div")
    .filter({ has: page.getByText("Median", { exact: true }) })
    .locator("strong");
  expect(uiNumber(await median.innerText())).toBeCloseTo(
    item.ensemble.flowP50[lastIndex],
    2,
  );
  await mode(page, "Airflow & paths");
  await toolSection(page, "conditions");
  await page
    .getByRole("slider", { name: "Fan speed", exact: true })
    .fill("0.8");
  await balanced(page);
  await mode(page, "Uncertainty");
  await expect(plot).toHaveCount(0);
  await toolSection(page, "primary");
  await expect(page.locator(".av-controls")).toContainText(
    "This edited state has no baked ensemble",
  );
  await page
    .getByRole("button", { name: "Reset canonical case", exact: true })
    .click();
  await balanced(page);
  await toolSection(page, "inspect");
  await expect(plot).toBeVisible();
});

test("learned fields are labeled approximations and reject a changed topology without substituting fabricated output", async ({
  page,
}) => {
  await openWorkbench(page);
  await mode(page, "Learned screening");
  await modelSection(page, "run");
  await page
    .getByRole("button", { name: "Run both models", exact: true })
    .click();
  const predicted = page.getByRole("button", {
    name: "Show predicted field in the mine",
    exact: true,
  });
  await expect(predicted).toBeVisible({ timeout: 60000 });
  await modelSection(page, "comparison");
  await expect(
    page.getByRole("img", { name: /^Where the approximation differs,/ }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Inspect", exact: true })
    .selectOption("flow");
  const comparison = page.getByRole("img", { name: /^Airway flow,/ });
  await comparison.press("ArrowRight");
  await comparison.press("ArrowRight");
  await comparison.press("Enter");
  await toolSection(page, "inspect");
  await expect(page.locator(".av-selected-readout h3")).toHaveText(
    "Main exhaust fan",
  );
  async function assertDisplayedPrediction() {
    await toolSection(page, "inspect");
    const lower = page.locator(".av-selected-readout");
    await expect(lower).toContainText("Selected airway \u00b7 approximation");
    const currentIntake = uiNumber(
      await page.locator(".av-viz-readout > strong").innerText(),
    );
    const currentFlow = uiNumber(
      await lower
        .locator("div")
        .filter({ has: page.getByText("Signed flow", { exact: true }) })
        .locator("strong")
        .innerText(),
    );
    // This case has one exhaust fan: predicted delivery and boundary supply agree.
    expect(currentFlow).toBeCloseTo(currentIntake, 1);
    const residualText = await lower
      .locator("div")
      .filter({
        has: page.getByText("Mass / pressure residual", { exact: true }),
      })
      .locator("strong")
      .innerText();
    const [mass, pressure] = residualText.split("/").map(uiNumber);
    await modelSection(page, "accuracy");
    const cards = page.locator(".av-learned-metrics");
    const cardMass = uiNumber(
      await cards
        .locator("div")
        .filter({ has: page.getByText("Nodal imbalance", { exact: true }) })
        .locator("strong")
        .innerText(),
    );
    const cardPressure = uiNumber(
      await cards
        .locator("div")
        .filter({ has: page.getByText("Pressure closure", { exact: true }) })
        .locator("strong")
        .innerText(),
    );
    expect(mass).toBe(Number(cardMass.toPrecision(2)));
    expect(Math.abs(pressure - cardPressure)).toBeLessThanOrEqual(
      Math.abs(cardPressure) * 0.06 + 0.005,
    );
  }
  await modelSection(page, "accuracy");
  await predicted.click();
  await expect(page.locator(".av-viz-readout")).toContainText(
    "topology-mlp \u00b7 approximation",
  );
  await assertDisplayedPrediction();
  await page
    .getByRole("button", { name: "Numerical field", exact: true })
    .click();
  await balanced(page);
  await page.getByRole("tab", { name: /^Graph surrogate/ }).click();
  await predicted.click();
  await expect(page.locator(".av-viz-readout")).toContainText(
    "graph-surrogate \u00b7 approximation",
  );
  await assertDisplayedPrediction();
  await importProject(page, analyticalNetwork());
  await mode(page, "Learned screening");
  await modelSection(page, "run");
  await page
    .getByRole("button", { name: "Run both models", exact: true })
    .click();
  await expect(page.locator(".av-learned-domain")).toContainText(
    "Outside training domain",
  );
  await expect(predicted).toHaveCount(0);
  await modelSection(page, "comparison");
  await expect(
    page.getByRole("img", { name: /^Where the approximation differs,/ }),
  ).toHaveCount(0);
  await balanced(page);
});

test("mobile uncertainty exposes selected quantiles and target probability from the actual recorded ensemble in both languages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const catalog = JSON.parse(
    await readFile(
      new URL("../../data/artifacts/catalog.json", import.meta.url),
      "utf8",
    ),
  ) as {
    cases: Array<{
      network: Network;
      ensemble: {
        flowP05: number[];
        flowP50: number[];
        flowP95: number[];
        targetProbability: number[];
        powerP05: number;
        powerP95: number;
      };
    }>;
  };
  await openWorkbench(page);
  const current = await project(page),
    item = catalog.cases.find(
      (item) => item.network.id === current.network.id,
    )!;
  const index = item.network.edges.reduce(
      (last, edge, index) => (edge.target > 0 ? index : last),
      -1,
    ),
    edge = item.network.edges[index];
  await mode(page, "Uncertainty");
  await toolSection(page, "inspect");
  const plot = page.getByRole("img", { name: /^Working-airway uncertainty/ });
  const box = (await plot.boundingBox())!;
  await plot.click({ position: { x: box.width - 14, y: box.height / 2 } });
  for (const lang of ["en", "es"] as const) {
    if (lang === "es")
      await page
        .getByRole("button", { name: "Switch language", exact: true })
        .click();
    await toolSection(page, "primary");
    const summary = page.getByRole("region", {
      name:
        lang === "es"
          ? "Incertidumbre de galería seleccionada"
          : "Selected airway uncertainty",
      exact: true,
    });
    await summary.scrollIntoViewIfNeeded();
    await expect(summary).toBeInViewport({ ratio: 0.8 });
    await expect(summary.getByRole("heading")).toHaveText(edge.name[lang]);
    const format = (value: number) =>
      value.toLocaleString(lang, { maximumFractionDigits: 2 });
    await expect(summary.locator("p").nth(0).locator("strong")).toHaveText(
      `${format(item.ensemble.flowP05[index])} -- ${format(item.ensemble.flowP95[index])} m³/s`,
    );
    await expect(summary.locator("p").nth(1).locator("strong")).toHaveText(
      `${format(item.ensemble.flowP50[index])} m³/s`,
    );
    await expect(summary.locator("p").nth(2).locator("strong")).toHaveText(
      `${format(item.ensemble.targetProbability[index] * 100)}%`,
    );
    const power = page.locator(".av-controls .av-ledger > div").filter({
      has: page.getByText(
        lang === "es" ? "Potencia P05–P95" : "Fan power P05–P95",
        { exact: true },
      ),
    });
    await power.scrollIntoViewIfNeeded();
    await expect(power).toBeInViewport();
    await expect(power.locator("strong")).toHaveText(
      `${format(item.ensemble.powerP05)} -- ${format(item.ensemble.powerP95)} kW`,
    );
    await page.locator(".av-controls .av-panel-close").click();
  }
});

test("energy and cost use actual solved fan power and preserve the captured comparison baseline", async ({
  page,
}) => {
  await openWorkbench(page);
  await importProject(page, analyticalNetwork());
  await mode(page, "Fan operations");
  await toolSection(page, "energy");
  await numeric(page, "Operating hours", 8000);
  await numeric(page, "Electricity tariff", 0.2);
  const energy = page.getByRole("region", {
    name: "Energy and cost",
    exact: true,
  });
  const value = (name: string) =>
    energy
      .locator("div")
      .filter({ has: page.getByText(name, { exact: true }) })
      .locator("strong");
  expect(uiNumber(await value("Annual energy").innerText())).toBe(10);
  expect(uiNumber(await value("Annual cost").innerText())).toBe(2000);
  await toolSection(page, "primary");
  await page
    .getByRole("combobox", { name: "Operating question", exact: true })
    .selectOption("baseline");
  await page
    .getByRole("button", { name: "Capture current baseline", exact: true })
    .click();
  await toolSection(page, "conditions");
  await page
    .getByRole("slider", { name: "Fan speed", exact: true })
    .fill("0.5");
  await balanced(page);
  await toolSection(page, "energy");
  expect(uiNumber(await value("Annual energy").innerText())).toBe(1.25);
  expect(uiNumber(await value("Annual cost").innerText())).toBe(250);
  expect(uiNumber(await value("Cost change from baseline").innerText())).toBe(
    -1750,
  );
  await toolSection(page, "primary");
  await page
    .getByRole("button", { name: "Show spatial flow differences", exact: true })
    .click();
  await expect(page.locator(".av-legend")).toContainText(
    "Flow difference from baseline",
  );
  await toolSection(page, "energy");
  await numeric(page, "Operating hours", 0);
  expect(uiNumber(await value("Annual energy").innerText())).toBe(0);
  expect(uiNumber(await value("Annual cost").innerText())).toBe(0);
  expect((await project(page)).options.speed).toBe(0.5);
});

test("isolating a working level changes actual scene hit testing without altering hydraulic inputs", async ({
  page,
}) => {
  const network = analyticalNetwork();
  network.nodes = [
    { id: "a", x: -100, y: -50, z: 0, boundary: 100 },
    { id: "b", x: 100, y: -50, z: 0, boundary: 0 },
    { id: "c", x: -100, y: 50, z: 0, boundary: 100 },
    { id: "d", x: 100, y: 50, z: 0, boundary: 0 },
  ];
  network.edges[0] = {
    ...network.edges[0],
    kind: "working",
    level: 0,
    name: { en: "Upper working passage", es: "Labor superior" },
  };
  delete network.edges[0].fan;
  network.edges.push({
    ...network.edges[0],
    id: "cd",
    from: "c",
    to: "d",
    level: 1,
    name: { en: "Lower working passage", es: "Labor inferior" },
  });
  await openWorkbench(page);
  await importProject(page, network);
  await mode(page, "Airflow & paths");
  await toolSection(page, "view");
  await page.getByRole("checkbox", { name: "Labels", exact: true }).check();
  await page
    .getByRole("combobox", { name: "Camera view", exact: true })
    .selectOption("plan");
  const canvas = page.locator("canvas");
  const selectPassage = async (from: string, to: string) => {
    const a = await page
      .getByRole("button", { name: `Junction ${from}`, exact: true })
      .evaluate((element) => ({
        x: parseFloat(element.style.left),
        y: parseFloat(element.style.top),
      }));
    const b = await page
      .getByRole("button", { name: `Junction ${to}`, exact: true })
      .evaluate((element) => ({
        x: parseFloat(element.style.left),
        y: parseFloat(element.style.top),
      }));
    await canvas.click({
      position: { x: a.x + (b.x - a.x) * 0.43, y: a.y + (b.y - a.y) * 0.43 },
    });
  };
  await selectPassage("c", "d");
  await toolSection(page, "inspect");
  await expect(page.locator(".av-selected-readout h3")).toHaveText(
    "Lower working passage",
  );
  const before = await project(page),
    flow = await page.locator(".av-viz-readout").innerText();
  await toolSection(page, "view");
  await page
    .getByRole("combobox", { name: "Level", exact: true })
    .selectOption("1");
  await selectPassage("a", "b");
  await toolSection(page, "inspect");
  await expect(page.locator(".av-selected-readout h3")).toHaveText(
    "Lower working passage",
  );
  await toolSection(page, "view");
  await page
    .getByRole("combobox", { name: "Level", exact: true })
    .selectOption("all");
  await selectPassage("a", "b");
  await toolSection(page, "inspect");
  await expect(page.locator(".av-selected-readout h3")).toHaveText(
    "Upper working passage",
  );
  const after = await project(page);
  expect(after.network).toEqual(before.network);
  expect(after.options).toEqual(before.options);
  expect(await page.locator(".av-viz-readout").innerText()).toBe(flow);
});

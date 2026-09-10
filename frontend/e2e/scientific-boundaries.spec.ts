import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Network, Options } from "../src/contracts";

const catalog = JSON.parse(
  await readFile(
    new URL("../../data/artifacts/catalog.json", import.meta.url),
    "utf8",
  ),
) as {
  cases: {
    network: Network;
    ensemble: { targetProbability: number[] };
  }[];
};

function authored(id = "hard-rock"): Network {
  const entry = catalog.cases.find((item) => item.network.id === id);
  if (!entry) throw new Error(`Missing authored case: ${id}`);
  return structuredClone(entry.network);
}

async function balanced(page: Page) {
  await expect(page.getByTestId("solver-status")).toHaveText(
    "Network balanced",
  );
}

async function openWorkbench(page: Page) {
  await page.goto("/");
  await balanced(page);
}

/** Exercise the actual file reader, project validator and asynchronous network solve. */
async function importProject(page: Page, network: Network, options: Options) {
  const text = JSON.stringify({
    schema: "aerovia.project/v1",
    network,
    options,
    savedAt: "2026-09-09T12:00:00Z",
  });
  await page
    .getByRole("button", { name: "Import network", exact: true })
    .click();
  await page.getByLabel("Choose JSON file", { exact: true }).setInputFiles({
    name: `${network.id}-project.json`,
    mimeType: "application/json",
    buffer: Buffer.from(text, "utf8"),
  });
  await expect(
    page.getByRole("textbox", { name: "Network JSON", exact: true }),
  ).toHaveValue(text);
  await page
    .getByRole("button", { name: "Validate and load", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await balanced(page);
}

async function analysis(page: Page) {
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
}

test("a feasible unequal-boundary project reports a search restriction without claiming infeasibility", async ({
  page,
}) => {
  await openWorkbench(page);
  const network = authored();
  network.nodes.find((node) => node.id === "atmosphere-in")!.boundary = 100;
  await importProject(page, network, {
    speed: 1.5,
    resistanceScale: 1,
    overrides: {},
  });

  // This supplied setting actually meets every entered target. A search-method
  // restriction must not erase that physically feasible operating point.
  await expect
    .poll(async () =>
      Number.parseFloat(await page.locator(".target-number").innerText()),
    )
    .toBeGreaterThan(100);
  await analysis(page);
  const demand = await page.locator(".big-energy").innerText();
  await page
    .locator(".analysis-actions")
    .getByRole("button", { name: "Find minimum fan speed", exact: true })
    .click();
  const search = page.locator(".optimization-result");
  await expect(search).toContainText("NO AUTOMATIC SETTING RETURNED");
  await expect(search).toContainText("Review the search result");
  await expect(search).toContainText("requires equal boundary pressures");
  await expect(search).not.toContainText(
    /Targets cannot all be met|NO FEASIBLE SETTING|targets are infeasible/i,
  );
  await expect(
    search.getByRole("button", { name: "Apply setting", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".big-energy")).toHaveText(demand);
});

test("edited closures and fan settings invalidate the bake and survive the instructed project export", async ({
  page,
}) => {
  await openWorkbench(page);
  await analysis(page);
  await expect(page.locator(".uncertainty .intervals")).toBeVisible();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Selected airway", exact: true })
    .selectOption("ramp-link-1");
  await page
    .getByRole("checkbox", { name: "Close this airway", exact: true })
    .check();
  await balanced(page);
  await page
    .getByRole("slider", { name: "Fan speed factor", exact: true })
    .fill("0.8");
  await balanced(page);
  await page
    .getByRole("slider", { name: "Network resistance", exact: true })
    .fill("1.3");
  await balanced(page);
  await analysis(page);
  const uncertainty = page.locator(".uncertainty");
  await expect(uncertainty.locator(".intervals")).toHaveCount(0);
  await expect(uncertainty).toContainText("no matching baked ensemble");
  await expect(uncertainty).toContainText(
    "Export a project, including network and settings",
  );

  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const project = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  expect(project.schema).toBe("aerovia.project/v1");
  expect(project.options.speed).toBe(0.8);
  expect(project.options.resistanceScale).toBe(1.3);
  expect(project.options.overrides["ramp-link-1"].closed).toBe(true);
});

test("a 255-of-256 conditional target frequency is displayed as 99.6 percent", async ({
  page,
}) => {
  await openWorkbench(page);
  const entry = catalog.cases.find(
    (item) => item.network.id === "twin-district",
  )!;
  const edgeIndex = entry.network.edges.findIndex(
    (edge) => edge.id === "west-production-1",
  );
  expect(entry.ensemble.targetProbability[edgeIndex]).toBe(255 / 256);
  await page
    .getByRole("combobox", { name: "Engineering case", exact: true })
    .selectOption(entry.network.id);
  await expect(
    page.getByRole("heading", { name: entry.network.name.en, exact: true }),
  ).toBeVisible();
  await balanced(page);
  await analysis(page);
  await expect(page.locator(".intervals")).toContainText(
    "Samples meeting target",
  );
  const row = page.locator(".intervals button").filter({
    has: page.getByText(entry.network.edges[edgeIndex].name.en, {
      exact: true,
    }),
  });
  await expect(row).toHaveCount(1);
  await expect(row.locator("strong")).toHaveText("99.6%");
  await expect(row.locator("strong")).not.toHaveText("100%");
});

test("zero fan speed shows a stopped point without inventing an equivalent system curve", async ({
  page,
}) => {
  await openWorkbench(page);
  await importProject(page, authored(), {
    speed: 0,
    resistanceScale: 1,
    overrides: {},
  });
  await expect(page.getByTestId("power")).toContainText(/^0(?:\.0+)?\s*kW$/);
  await analysis(page);
  await expect(
    page.getByRole("img", { name: /Fan operating point/ }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The common fan speed is zero. A system curve cannot be inferred from this stopped operating point.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page
      .locator(".plot-legend")
      .getByText("Equivalent network", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".cost-line")
      .filter({ hasText: "Delivered fan pressure" })
      .locator("strong"),
  ).toHaveText("0.0 Pa");
  await expect(
    page.getByText(/This network has multiple pressure sources/),
  ).toHaveCount(0);
});

test("closing every fan removes its operating point and delivered-pressure claim", async ({
  page,
}) => {
  await openWorkbench(page);
  const network = authored();
  const overrides = Object.fromEntries(
    network.edges
      .filter((edge) => edge.fan)
      .map((edge) => [edge.id, { closed: true }]),
  );
  await importProject(page, network, {
    speed: 1,
    resistanceScale: 1,
    overrides,
  });
  await expect(page.getByTestId("power")).toContainText(/^0(?:\.0+)?\s*kW$/);
  await analysis(page);
  await expect(
    page.getByRole("heading", {
      name: "All fan branches are closed",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Closed branches are excluded from the solved pressure network. No active fan operating point or delivered fan pressure is shown.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Fan operating point/ }),
  ).toHaveCount(0);
  await expect(
    page.locator(".cost-line").filter({ hasText: "Delivered fan pressure" }),
  ).toHaveCount(0);
});

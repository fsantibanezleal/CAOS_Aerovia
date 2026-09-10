import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const catalog = JSON.parse(
  await readFile(
    new URL("../../data/artifacts/catalog.json", import.meta.url),
    "utf8",
  ),
);
const balanced = async (page: Page) =>
  expect(page.getByTestId("solver-status")).toHaveText("Network balanced");
async function load(page: Page) {
  await page.goto("/");
  await balanced(page);
}
async function slider(page: Page, label: string, value: string) {
  await page.getByRole("slider", { name: label, exact: true }).fill(value);
  await balanced(page);
  await page.waitForTimeout(250);
}

test("spatial controls, real numerical change, baseline, undo and local recovery", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  const initial = await page.getByTestId("power").innerText();
  await page
    .getByRole("button", { name: "Save baseline", exact: true })
    .click();
  await slider(page, "Fan speed factor", "1.2");
  await expect(page.getByTestId("power")).not.toHaveText(initial);
  const changed = await page.getByTestId("power").innerText();
  await page
    .getByRole("combobox", { name: "Color by", exact: true })
    .selectOption("change");
  await page.getByRole("button", { name: "Pause flow animation" }).click();
  await expect(
    page.getByRole("button", { name: "Play flow animation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle context envelope" }).click();
  await slider(page, "Section depth", "0.7");
  await page.getByRole("button", { name: "Toggle focus mode" }).click();
  await expect(page.locator(".controls-panel")).toBeHidden();
  await page.getByRole("button", { name: "Toggle focus mode" }).click();
  await page.getByRole("button", { name: "Undo change" }).click();
  await balanced(page);
  await expect(page.getByTestId("power")).toHaveText(initial);
  await page.getByRole("button", { name: "Redo change" }).click();
  await balanced(page);
  await expect(page.getByTestId("power")).toHaveText(changed);
  await page.waitForTimeout(600);
  await page.reload();
  await balanced(page);
  await expect(page.getByTestId("power")).toHaveText(changed);
  expect(errors).toEqual([]);
});

test("airway edits change flow and closure reports model consequences", async ({
  page,
}) => {
  await load(page);
  const initial = await page.locator(".inspector-flow strong").innerText();
  const resistance = page.getByRole("spinbutton", {
    name: "Airway resistance",
    exact: true,
  });
  await resistance.fill("1.5");
  await resistance.press("Enter");
  await balanced(page);
  await expect(page.locator(".inspector-flow strong")).not.toHaveText(initial);
  await page.getByRole("checkbox", { name: "Close this airway" }).check();
  await page.waitForTimeout(400);
  await expect(
    page.getByRole("checkbox", { name: "Close this airway" }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "Close this airway" }).uncheck();
  await balanced(page);
});

test("optimization, operating curves and sensitivity produce actionable calculations", async ({
  page,
}) => {
  await load(page);
  await page
    .getByRole("button", { name: "Find minimum fan speed", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Apply setting", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Apply setting", exact: true })
    .click();
  await balanced(page);
  await expect(page.locator(".target-number")).toContainText("100");
  await page
    .getByRole("button", { name: "Calculate operating envelope", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: /Common-speed operating envelope/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rank resistance sensitivity", exact: true })
    .click();
  await expect(page.locator(".sensitivity-list>button")).toHaveCount(12);
  await page.locator(".sensitivity-list>button").first().click();
  await expect(
    page.getByRole("heading", {
      name: catalog.cases[0].network.name.en,
      exact: true,
    }),
  ).toBeVisible();
});

test("JSON project export roundtrips exact edited inputs, malformed imports preserve state", async ({
  page,
}) => {
  await load(page);
  await slider(page, "Fan speed factor", "0.83");
  const power = await page.getByTestId("power").innerText();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const file = await downloadEvent;
  const content = await readFile((await file.path())!, "utf8");
  const project = JSON.parse(content);
  expect(project.options.speed).toBe(0.83);
  await page
    .getByRole("button", { name: "Import network", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Network JSON", exact: true })
    .fill('{"schema":"invalid"}');
  await page
    .getByRole("button", { name: "Validate and load", exact: true })
    .click();
  await expect(page.locator(".inline-error")).toBeVisible();
  await expect(page.getByTestId("power")).toHaveText(power);
  await page
    .getByRole("textbox", { name: "Network JSON", exact: true })
    .fill(content);
  await page
    .getByRole("button", { name: "Validate and load", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await balanced(page);
  await expect(page.getByTestId("power")).toHaveText(power);
  await page.getByRole("button", { name: "Network", exact: true }).click();
  const csvEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Results CSV", exact: true }).click();
  const csv = await readFile((await (await csvEvent).path())!, "utf8");
  expect(csv).toContain("flow_m3_s");
  expect(csv.split("\n").length).toBe(project.network.edges.length + 1);
});

test("all cases solve and all view/theme/language combinations fit the viewport", async ({
  page,
}, testInfo) => {
  // This complete matrix saves 24 WebGL screenshots; software rendering on CI
  // needs a larger total capture budget. Individual state assertions keep their limit.
  testInfo.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  for (const c of catalog.cases) {
    await page
      .getByRole("combobox", { name: "Engineering case", exact: true })
      .selectOption(c.network.id);
    await balanced(page);
    await expect(
      page.getByRole("heading", { name: c.network.name.en, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${c.network.id}-dark.png`),
    });
  }
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.getByRole("button", { name: "Toggle theme" }).click();
    for (const route of ["Workspace", "Analysis", "Network", "Evidence"]) {
      await page.getByRole("button", { name: route, exact: true }).click();
      await page.waitForTimeout(150);
      const fit = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
        iw: innerWidth,
        ih: innerHeight,
      }));
      expect(fit.w).toBe(fit.iw);
      expect(fit.h).toBe(fit.ih);
      await page.screenshot({
        path: testInfo.outputPath(`${route}-${theme}.png`),
      });
    }
  }
  await page.getByRole("button", { name: "Change language" }).click();
  await expect(
    page.getByRole("button", { name: "Espacio", exact: true }),
  ).toBeVisible();
  for (const route of ["Espacio", "Análisis", "Red", "Evidencia"]) {
    await page.getByRole("button", { name: route, exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`es-${route}.png`) });
  }
  expect(errors).toEqual([]);
});

test("mobile tools remain reachable and every page fits", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page);
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await slider(page, "Fan speed factor", "1.1");
  await page
    .getByRole("button", { name: "Close controls", exact: true })
    .click();
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Airway resistance", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();
  for (const name of ["Workspace", "Analysis", "Network", "Evidence"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(150);
    const fit = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
      innerWidth,
      innerHeight,
    ]);
    expect(fit[0]).toBe(fit[2]);
    expect(fit[1]).toBe(fit[3]);
    await page.screenshot({ path: testInfo.outputPath(`mobile-${name}.png`) });
  }
});

import { chromium } from "../../frontend/node_modules/playwright/index.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const appUrl = (process.env.AEROVIA_QA_URL ?? "http://127.0.0.1:5908").replace(
  /\/$/,
  "",
);
const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(root, "build/local/benchmark-review");
await mkdir(out, { recursive: true });
const science = JSON.parse(
  await readFile(path.join(root, "data/artifacts/science.json"), "utf8"),
);
const browser = await chromium.launch({ headless: true });
const evidence = [];
const errors = [];
for (const lang of ["en", "es"]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript((lang) => {
    localStorage.setItem("caos.lang", lang);
    localStorage.setItem("caos.theme", lang === "en" ? "dark" : "light");
  }, lang);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push({ lang, error: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push({ lang, consoleError: message.text() });
  });
  await page.goto(`${appUrl}/benchmark`, { waitUntil: "networkidle" });
  const tabs = page.locator(".av-doc-scroll .subtablist [role=tab]");
  await tabs.nth(1).click();
  const input = page.getByLabel(
    lang === "en" ? "Held-out input" : "Entrada reservada",
    { exact: true },
  );
  await input.waitFor();
  for (const fixture of science.heldoutFixtures) {
    await input.selectOption(fixture.sampleId);
    await page
      .getByRole("button", {
        name:
          lang === "en"
            ? "Run reference and both models"
            : "Ejecutar referencia y ambos modelos",
        exact: true,
      })
      .click();
    await page
      .getByText(
        lang === "en" ? "Approximation executed" : "Aproximación ejecutada",
        { exact: true },
      )
      .first()
      .waitFor({ timeout: 60000 });
    assert.equal(
      await page
        .getByText(
          lang === "en" ? "Approximation executed" : "Aproximación ejecutada",
          { exact: true },
        )
        .count(),
      2,
    );
    const alerts = await page
      .locator(".av-doc-scroll [role=alert]")
      .allTextContents();
    assert.deepEqual(alerts, []);
    const table = await page
      .locator(".av-doc-scroll table")
      .first()
      .innerText();
    assert.ok(!table.includes("NaN"));
    await page
      .getByLabel(lang === "en" ? "Inspect method" : "Método a inspeccionar", {
        exact: true,
      })
      .selectOption("graph-surrogate");
    await page
      .getByLabel(lang === "en" ? "Quantity" : "Magnitud", { exact: true })
      .selectOption("flow");
    evidence.push({
      lang,
      networkId: fixture.networkId,
      fixture: fixture.sampleId,
      localResultTable: table,
      result: "Both exported models actually executed",
    });
  }
  await page.screenshot({ path: path.join(out, `${lang}-heldout.png`) });
  await tabs.nth(2).click();
  const method = page.getByLabel(lang === "en" ? "Method" : "Método", {
    exact: true,
  });
  const quantity = page.getByLabel(
    lang === "en" ? "Map quantity" : "Magnitud del mapa",
    { exact: true },
  );
  const map = page.getByRole("table", {
    name:
      lang === "en"
        ? "Interactive held-out error map"
        : "Mapa interactivo de errores reservados",
    exact: true,
  });
  for (const methodId of [
    "scipy-reference",
    "topology-mlp",
    "graph-surrogate",
  ]) {
    await method.selectOption(methodId);
    for (const value of [
      "flowMAE",
      "flowRMSE",
      "pressureMAE",
      "pressureResidualMax",
    ]) {
      await quantity.selectOption(value);
      assert.equal(await map.getByRole("button").count(), 72);
      await map.getByRole("button").nth(49).click();
      assert.equal(
        await page
          .getByLabel(lang === "en" ? "Case" : "Caso", { exact: true })
          .inputValue(),
        "return-restriction",
      );
      assert.equal(
        await page
          .getByLabel(lang === "en" ? "Regime" : "Régimen", { exact: true })
          .inputValue(),
        "turndown",
      );
      assert.equal(await map.locator("button[aria-pressed=true]").count(), 1);
      const row = science.benchmark.rows.find(
        (row) =>
          row.methodId === methodId &&
          row.networkId === "return-restriction" &&
          row.regimeId === "turndown",
      );
      assert.ok(row);
      const support = await page
        .getByText(
          new RegExp(
            `${lang === "en" ? "Classification observations:" : "Observaciones de clasificación:"}\\s*${row.classificationObservations}`,
          ),
        )
        .count();
      assert.equal(support, 1);
      evidence.push({
        lang,
        methodId,
        quantity: value,
        cells: 72,
        selectedCell: "return-restriction/turndown",
        classificationObservations: row.classificationObservations,
      });
    }
  }
  await map.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${lang}-matrix.png`) });
  await tabs.nth(3).click();
  await page
    .getByLabel(lang === "en" ? "Compare error" : "Error a comparar", {
      exact: true,
    })
    .selectOption("flowRMSE");
  const panel = page.locator(".av-doc-scroll [role=tabpanel]:not([hidden])");
  const text = await panel.innerText();
  assert.ok(text.includes("200") && text.includes("400"));
  assert.ok(text.includes(lang === "en" ? "89.45" : "89,45"));
  const svg = panel.locator(".plot svg").first();
  if (await svg.count()) await svg.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${lang}-degradation.png`) });
  await tabs.nth(5).click();
  for (const file of [
    "science.json",
    "catalog.json",
    "models/registry.json",
    "models/browser-evidence.json",
  ]) {
    const response = await page.request.get(`${appUrl}/data/${file}`);
    assert.equal(response.status(), 200);
    assert.ok((await response.json()).schema);
  }
  await context.close();
}
await browser.close();
assert.deepEqual(errors, []);
await writeFile(
  path.join(out, "review.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      sourceSha256: science.sourceSha256,
      evidence,
      errors,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    { actualModelExecutions: 48, mapSelections: 24, errors, out },
    null,
    2,
  ),
);

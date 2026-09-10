import { test } from "./helpers";
import { expect } from "@playwright/test";
import {
  balanced,
  mode,
  noDocumentOverflow,
  numeric,
  openWorkbench,
  parameters,
  project,
  uiNumber,
} from "./helpers";

test.use({ locale: "en-US", actionTimeout: 10000 });
const appearances = [
  { lang: "en", theme: "dark" },
  { lang: "en", theme: "light" },
  { lang: "es", theme: "dark" },
  { lang: "es", theme: "light" },
] as const;
const routes = [
  { path: "/", en: "App", es: "App" },
  { path: "/introduction", en: "Introduction", es: "Introducción" },
  { path: "/methodology", en: "Methodology", es: "Metodología" },
  { path: "/implementation", en: "Implementation", es: "Implementación" },
  { path: "/experiments", en: "Experiments", es: "Experimentos" },
  { path: "/benchmark", en: "Benchmark", es: "Benchmark" },
];
async function appearance(
  page: import("@playwright/test").Page,
  lang: "en" | "es",
  theme: "dark" | "light",
) {
  await openWorkbench(page);
  if ((await page.locator("html").getAttribute("data-theme")) !== theme)
    await page
      .getByRole("button", { name: "Toggle light / dark", exact: true })
      .click();
  if (lang === "es")
    await page
      .getByRole("button", { name: "Switch language", exact: true })
      .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("html")).toHaveAttribute("lang", lang);
}

for (const { lang, theme } of appearances)
  test(`the six shared-shell routes and deep content panels work in ${lang}/${theme}`, async ({
    page,
  }, info) => {
    info.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await appearance(page, lang, theme);
    await expect(page.locator(".main-nav a")).toHaveCount(6);
    for (const route of routes) {
      await page
        .locator(".main-nav")
        .getByRole("link", { name: route[lang], exact: true })
        .click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(route.path);
      if (route.path === "/") await balanced(page, lang);
      else {
        await expect(
          page.getByRole("heading", { name: route[lang], exact: true }).first(),
        ).toBeVisible();
        const tabs = page.getByRole("tab");
        for (let i = 0, count = await tabs.count(); i < count; i++) {
          await tabs.nth(i).click();
          await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true");
          await expect(page.getByRole("tabpanel")).toBeVisible();
          await expect(page.locator(".katex-error")).toHaveCount(0);
          await expect(page.getByRole("tabpanel")).not.toBeEmpty();
          await noDocumentOverflow(page);
        }
        if (await tabs.count()) await tabs.first().click();
      }
      await noDocumentOverflow(page);
      await page.screenshot({
        path: info.outputPath(`${route.en.toLowerCase()}-${lang}-${theme}.png`),
        animations: "disabled",
      });
    }
    expect(errors).toEqual([]);
  });

test("the benchmark reruns exact calculations and exposes same-input numerical agreement", async ({
  page,
}) => {
  await openWorkbench(page);
  await page
    .locator(".main-nav")
    .getByRole("link", { name: "Benchmark", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run exact local calculation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "The local solution meets residual limits",
  );
  const difference = page
    .getByRole("row")
    .filter({
      has: page.getByRole("rowheader", {
        name: "Maximum flow difference (m³/s)",
        exact: true,
      }),
    })
    .getByRole("cell")
    .first();
  expect(uiNumber(await difference.innerText())).toBeLessThan(1e-5);
  await expect(
    page.getByRole("img", { name: /^Signed error by airway,/ }),
  ).toBeVisible();
  const selector = page.getByRole("combobox", { name: /^Comparison case/ });
  await selector.selectOption("deep-five-level");
  await expect(
    page.getByRole("img", { name: /^Signed error by airway,/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Run exact local calculation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "The local solution meets residual limits",
  );
  expect(uiNumber(await difference.innerText())).toBeLessThan(1e-5);
});

test("held-out browser inference runs both exported models and renders actual comparison errors", async ({
  page,
}) => {
  test.setTimeout(120000);
  await openWorkbench(page);
  await page
    .locator(".main-nav")
    .getByRole("link", { name: "Benchmark", exact: true })
    .click();
  await page
    .getByRole("tab", { name: "Held-out inference", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run reference and both models", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Approximation executed", exact: true }),
  ).toHaveCount(2, { timeout: 60000 });
  await expect(
    page.getByRole("cell", { name: "Accepted", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /^Prediction and reference on the same input,/,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: /^Inspect method/ })
    .selectOption("graph-surrogate");
  await page.getByRole("combobox", { name: /^Quantity/ }).selectOption("flow");
  await expect(
    page.locator(".plot").filter({
      has: page.getByRole("heading", {
        name: "Prediction and reference on the same input",
        exact: true,
      }),
    }),
  ).toContainText("Graph surrogate");
  await page.getByText("Inspect airway values", { exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Prediction (m³/s)", exact: true }),
  ).toBeVisible();
});

for (const mobile of [false, true])
  test(`architecture diagrams and keyboard focus remain usable on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, info) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await openWorkbench(page);
    const trigger = page.getByRole("button", {
      name: "Architecture / How it works",
      exact: true,
    });
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "How Aerovia works",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "close", exact: true }),
    ).toBeFocused();
    const tabs = dialog.getByRole("tab");
    await expect(tabs).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await tabs.nth(i).click();
      const svg = dialog.locator("svg");
      await expect(svg).toHaveCount(1);
      await svg.scrollIntoViewIfNeeded();
      const escaped = await svg.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll("text")]
          .filter((text) => {
            const r = text.getBoundingClientRect();
            return (
              r.width > 0 &&
              r.height > 0 &&
              (r.left < bounds.left - 1 ||
                r.right > bounds.right + 1 ||
                r.top < bounds.top - 1 ||
                r.bottom > bounds.bottom + 1)
            );
          })
          .map((text) => text.textContent);
      });
      expect(escaped).toEqual([]);
      if (mobile) {
        const fittedWidth = (await svg.boundingBox())!.width;
        await dialog
          .getByRole("button", { name: "Read at full size", exact: true })
          .click();
        expect((await svg.boundingBox())!.width).toBeGreaterThan(
          fittedWidth * 2,
        );
        const region = dialog.getByRole("region", {
          name: "Architecture diagram",
          exact: true,
        });
        expect(
          await region.evaluate(
            (element) => element.scrollWidth > element.clientWidth,
          ),
        ).toBe(true);
        await region.focus();
        await region.press("ArrowRight");
        await expect
          .poll(() => region.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
        await dialog
          .getByRole("button", { name: "Fit diagram", exact: true })
          .click();
        expect((await svg.boundingBox())!.width).toBeCloseTo(fittedWidth, 0);
      }
      await noDocumentOverflow(page);
    }
    await page.screenshot({
      path: info.outputPath(
        `architecture-${mobile ? "mobile" : "desktop"}.png`,
      ),
    });
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

test("mobile tool panels, focus view and appearance changes preserve the engineering state", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkbench(page);
  await noDocumentOverflow(page);
  await mode(page, "Airflow & paths");
  await parameters(page);
  await page
    .getByRole("slider", { name: "Fan speed", exact: true })
    .fill("0.7");
  await balanced(page);
  const controls = page.locator(".av-controls");
  await controls.locator(".av-panel-close").click();
  const before = await project(page);
  expect(before.options.speed).toBe(0.7);
  await page
    .getByRole("button", { name: "Toggle focus view", exact: true })
    .click();
  await expect(page.locator(".av-workbench")).toHaveClass(/av-focus/);
  await noDocumentOverflow(page);
  await page
    .getByRole("button", { name: "Toggle focus view", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle light / dark", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Switch language", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("tab", { name: "Flujo y rutas", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await noDocumentOverflow(page);
  await page.screenshot({
    path: info.outputPath("mobile-spanish-light.png"),
    animations: "disabled",
  });
  await page.reload();
  await balanced(page, "es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page
    .getByRole("button", { name: "Cambiar idioma", exact: true })
    .click();
  expect((await project(page)).options).toEqual(before.options);
});

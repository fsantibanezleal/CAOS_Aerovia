import { expect, type Page } from "@playwright/test";
import { test } from "./helpers";

// The Experiments and Benchmark pages at their ADR-0017 section 2.1 floors, on the built site, in both languages
// (shell 0.15.0). The unit tests in src/pages/experiments-benchmark.test.ts assert the content; this file measures what a
// server render cannot: the drawn charts, the controls the pointer reaches, the page at 390 px.
test.use({ locale: "en-US", actionTimeout: 10000 });

type Lang = "en" | "es";
const LANGS: Lang[] = ["en", "es"];
const tab = (lang: Lang, en: string, es: string) => (lang === "en" ? en : es);

async function open(page: Page, path: string, lang: Lang) {
  await page.addInitScript((l) => localStorage.setItem("caos.lang", l), lang);
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("lang", lang);
  await expect(page.locator("[data-doc-page]")).toHaveCount(1);
}
const topic = (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true }).click();
async function noSidewaysScroll(page: Page, where: string) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [
    Math.max(
      document.documentElement.scrollWidth,
      ...[
        ...document.querySelectorAll(".page-body, main, [data-doc-page]"),
      ].map((e) => e.scrollWidth),
    ),
    window.innerWidth,
  ]);
  expect(
    scrollWidth,
    `${where}: the page scrolls sideways`,
  ).toBeLessThanOrEqual(innerWidth);
}

for (const lang of LANGS) {
  test(`Experiments: the protocol figure is captioned, the licence is not read as a decimal (${lang})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/experiments", lang);
    await topic(page, tab(lang, "Learning", "Aprendizaje"));
    const section = page.locator('[data-doc-section][data-area="protocol"]');
    await expect(section).toHaveCount(1);
    await expect(section.locator("figure svg")).toHaveCount(1);
    const caption = await section.locator("figure figcaption").innerText();
    expect(caption).toContain("room-pillar");
    expect(caption).toContain("11");
    await noSidewaysScroll(page, `experiments learning ${lang}`);

    await topic(page, tab(lang, "Data", "Datos"));
    const licences = page.locator('[data-area="datasets"] td [translate="no"]');
    await expect(licences.first()).toHaveText("Apache-2.0");
    await noSidewaysScroll(page, `experiments data ${lang}`);
  });

  test(`Benchmark: robustness chart, results table, live controls, one caveat (${lang})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/benchmark", lang);

    await topic(page, tab(lang, "Degradation", "Degradación"));
    const robustness = page.locator(
      '[data-doc-section][data-area="robustness"]',
    );
    await expect(robustness.locator("svg[data-chart]")).toHaveCount(1);
    await expect(robustness.locator("table").first()).toBeVisible();
    await noSidewaysScroll(page, `benchmark degradation ${lang}`);

    await topic(page, tab(lang, "Uncertainty", "Incertidumbre"));
    const results = page.locator('[data-doc-section][data-area="results"]');
    await expect(results.locator("table").first()).toBeVisible();
    await noSidewaysScroll(page, `benchmark uncertainty ${lang}`);

    await topic(page, tab(lang, "Held-out inference", "Inferencia reservada"));
    const live = page.locator('[data-doc-section][data-area="live"]');
    await expect(live).toHaveCount(1);
    expect(await live.locator("[data-control]").count()).toBeGreaterThanOrEqual(
      2,
    );
    await expect(page.locator(".th-refs")).toHaveCount(0);
    await noSidewaysScroll(page, `benchmark held-out ${lang}`);

    await topic(page, tab(lang, "Matrix and errors", "Matriz y errores"));
    const caveat = page.locator('[data-doc-section][data-area="caveat"]');
    await expect(caveat).toHaveCount(1);
    await expect(caveat.locator(".callout-honest")).toHaveCount(1);
    await noSidewaysScroll(page, `benchmark matrix ${lang}`);
  });

  // The matrix cells were covered by the sticky row header at 390 px (gate G5). The probe is the gate's: align each control
  // to the left edge of its scroll container, then require the pointer at the centre of its visible part to land on it.
  test(`Benchmark: every matrix control is reachable by the pointer at 390 px (${lang})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/benchmark", lang);
    await topic(page, tab(lang, "Matrix and errors", "Matriz y errores"));
    const buttons = page.locator(".av-matrix td button");
    await expect(buttons.first()).toBeVisible();
    const total = await buttons.count();
    expect(total).toBeGreaterThanOrEqual(11);
    const covered = await page.evaluate(() => {
      const out: string[] = [];
      const cells = [
        ...document.querySelectorAll<HTMLElement>(".av-matrix td button"),
      ];
      for (const el of cells) {
        el.scrollIntoView({ block: "center", inline: "nearest" });
        // align the control's left edge to the left edge of every horizontal scroller above it
        for (
          let a = el.parentElement;
          a && a !== document.body;
          a = a.parentElement
        ) {
          const s = getComputedStyle(a);
          if (
            (s.overflowX === "auto" || s.overflowX === "scroll") &&
            a.scrollWidth > a.clientWidth
          )
            a.scrollLeft +=
              el.getBoundingClientRect().left - a.getBoundingClientRect().left;
        }
        const r = el.getBoundingClientRect();
        const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
        const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
        const hit = document.elementFromPoint(x, y);
        if (!hit || !(hit === el || el.contains(hit)))
          out.push(
            `${el.getAttribute("aria-label")} covered by ${hit?.tagName}`,
          );
      }
      return out;
    });
    expect(covered).toEqual([]);
  });
}

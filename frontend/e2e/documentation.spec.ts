import { expect, type Page } from "@playwright/test";
import { test } from "./helpers";

test.use({ locale: "en-US" });

// The documentation framework on the built site (shell 0.15.0, ADR-0017 sections 2.1 and 4): every page sits on DocPage,
// and the shell draws ONE references block per page or open topic, at its end. The block is drawn in a layout effect, so it
// is measured here and not in the server-render tests of src/pages/documentation.test.ts.
const ROUTES = [
  "introduction",
  "methodology",
  "implementation",
  "experiments",
  "benchmark",
];

/** Every tab of the page, one by one (a click can reveal the next level), calling `visit` on each open state. */
async function eachTopic(page: Page, visit: (label: string) => Promise<void>) {
  const seen = new Set<string>();
  for (let round = 0; round < 40; round++) {
    const tabs = await page.locator('[role="tab"]').evaluateAll((els) =>
      els.map((e, i) => ({
        i,
        key: `${e.id}|${e.textContent?.trim()}`,
        shown: !!e.getClientRects().length,
      })),
    );
    const next = tabs.find((t) => t.shown && !seen.has(t.key));
    if (!next) return;
    seen.add(next.key);
    await page.locator('[role="tab"]').nth(next.i).click();
    await visit(next.key);
  }
}

for (const route of ROUTES) {
  test(`${route} sits on DocPage and ends each open topic with one references block`, async ({
    page,
  }) => {
    await page.goto(`/${route}`);
    await expect(page.locator("[data-doc-page]")).toHaveCount(1);
    await expect(page.locator("[data-doc-page] h1")).toHaveCount(1);
    // No inline "References" row survives inside a section. The Benchmark's two live tools (content/BenchmarkTools.tsx, the
    // Benchmark page unit's file) still draw their own row outside any DocSection: recorded, not hidden.
    await expect(page.locator("[data-doc-section] .th-refs")).toHaveCount(0);
    if (route !== "benchmark")
      await expect(page.locator(".th-refs")).toHaveCount(0);

    const checkOpenState = async (label: string) => {
      const blocks = page.locator("[data-doc-references]");
      const n = await blocks.count();
      const sections = await page.locator("[data-doc-section]").count();
      if (sections === 0) {
        // The executive view, and the Benchmark topics that hold only a live tool (BenchmarkTools.tsx: no DocSection yet),
        // register nothing, so the shell draws no block there.
        const executive = await page
          .locator('[data-tab="executive"][aria-selected="true"]')
          .count();
        expect(
          executive > 0 || route === "benchmark",
          `${route} ${label}: a topic without a DocSection`,
        ).toBe(true);
        expect(n, `${route} ${label}: no section, no references block`).toBe(0);
        return;
      }
      await page.waitForTimeout(150);
      expect(
        await blocks.count(),
        `${route} ${label}: exactly one references block`,
      ).toBe(1);
      const atEnd = await blocks.first().evaluate((el) => {
        const parent = el.parentElement!;
        const after = [...parent.children].slice(
          [...parent.children].indexOf(el) + 1,
        );
        // nothing visible follows the block inside the scope that holds it
        return after.filter(
          (e) => (e as HTMLElement).getClientRects().length > 0,
        ).length;
      });
      expect(
        atEnd,
        `${route} ${label}: nothing follows the references block`,
      ).toBe(0);
      const items = await blocks.first().locator("ol > li").count();
      expect(
        items,
        `${route} ${label}: the block lists its citations`,
      ).toBeGreaterThan(0);
    };

    await page.waitForTimeout(800);
    await checkOpenState("opening state");
    await eachTopic(page, checkOpenState);
  });
}

test("the Introduction opens on the executive view, with no equation or glossary visible", async ({
  page,
}) => {
  await page.goto("/introduction");
  await expect(page.locator('[data-tab="executive"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator('[data-tab="technical"]')).toHaveAttribute(
    "aria-selected",
    "false",
  );
  await expect(page.locator(".katex")).toHaveCount(0);
  await expect(page.locator("[data-glossary]")).toHaveCount(0);
  await expect(page.locator("[data-doc-section]")).toHaveCount(0);
});

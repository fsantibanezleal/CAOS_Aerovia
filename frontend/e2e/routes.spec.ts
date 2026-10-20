import { expect } from "@playwright/test";
import { balanced, test } from "./helpers";

test.use({ locale: "en-US" });

// The route table of shell 0.15.0 (src/routes.ts): the App is /app, the landing opens the Introduction, and an old App
// link (the App was the root until 0.04.000) is forwarded to /app with its query string and its hash kept.
const here = (page: import("@playwright/test").Page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}${url.hash}`;
};

test("the header order is App, Introduction, Methodology, Implementation, Experiments, Benchmark", async ({
  page,
}) => {
  await page.goto("/app");
  await balanced(page);
  await expect(page.locator(".main-nav a")).toHaveText([
    "App",
    "Introduction",
    "Methodology",
    "Implementation",
    "Experiments",
    "Benchmark",
  ]);
});

test("the root opens the Introduction", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => here(page)).toBe("/introduction");
  await expect(
    page.getByRole("heading", { name: "Introduction", exact: true }).first(),
  ).toBeVisible();
});

test("an unknown path opens the Introduction", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect.poll(() => here(page)).toBe("/introduction");
});

test("an old App link reaches /app with its query string and its hash, and the App loads", async ({
  page,
}) => {
  await page.goto("/?case=room-pillar&mode=flow&tool=primary#instrument");
  await expect
    .poll(() => here(page))
    .toBe("/app?case=room-pillar&mode=flow&tool=primary#instrument");
  await expect(page.locator("canvas")).toBeVisible();
  await balanced(page);
});

test("a deep link to /app loads the App directly", async ({ page }) => {
  await page.goto("/app?case=room-pillar");
  await expect.poll(() => here(page)).toBe("/app?case=room-pillar");
  await balanced(page);
});

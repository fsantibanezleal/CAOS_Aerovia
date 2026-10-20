import { expect, type Page } from "@playwright/test";
import {
  test,
  balanced,
  openWorkbench,
  project,
  railSection,
} from "./helpers";
import { GROUPS } from "../src/workbench/groups";

test.use({ locale: "en-US", actionTimeout: 10000 });

const CASE = "room-pillar";
const search = (group: string, sub?: string, extra = "") =>
  `/app?case=${CASE}&view=${group}${sub ? `&sub=${sub}` : ""}${extra}`;

async function shown(page: Page) {
  return page.evaluate(() => {
    const wb = document.querySelector("[data-case-workbench]");
    const shell = document.querySelector("[data-focus-shell]");
    const group = shell
      ? wb?.getAttribute("data-focus-group")
      : wb?.querySelector("[role=tabpanel]")?.getAttribute("data-panel");
    return {
      caseId: wb?.getAttribute("data-case") ?? null,
      group: group ?? null,
      sub:
        document
          .querySelector("[data-case-workbench] .subtab.active")
          ?.getAttribute("data-tab") ?? null,
      focus: Boolean(shell),
      search: location.search,
    };
  });
}

test("the App shows five question groups and the Context view as six peers", async ({
  page,
}) => {
  await openWorkbench(page);
  const tabs = page.locator("[data-case-workbench] > .tabs > .tablist > .tab");
  await expect(tabs).toHaveCount(6);
  await expect(tabs).toHaveText([
    "Design",
    "Airflow",
    "Transport",
    "Uncertainty",
    "Learned models",
    "Context",
  ]);
  await expect(
    page.locator("[data-case-workbench] > .tabs > .tablist [role=tab]"),
  ).toHaveCount(6);
});

for (const group of GROUPS)
  for (const sub of group.subs)
    test(`the URL opens ${group.id} / ${sub.id}, Focus keeps it and Escape returns to it`, async ({
      page,
    }) => {
      await page.goto(search(group.id, sub.id));
      await expect(page.locator("canvas")).toBeVisible();
      await balanced(page);
      const app = await shown(page);
      expect(app).toMatchObject({
        caseId: CASE,
        group: group.id,
        sub: sub.id,
        focus: false,
      });
      await expect(
        page.getByRole("tab", { selected: true }).first(),
      ).toBeVisible();
      await expect(
        page.locator(`.subtab.active[data-tab="${sub.id}"]`),
      ).toBeVisible();
      // The stage is the instrument: Focus opens from the scene's group on the same case, group and sub-view.
      await page.locator("[data-focus-enter]").click();
      await expect(page.locator("[data-focus-shell]")).toBeVisible();
      await expect(page.locator("canvas")).toBeVisible();
      const inFocus = await shown(page);
      expect(inFocus).toMatchObject({
        caseId: CASE,
        group: group.id,
        sub: sub.id,
        focus: true,
      });
      const q = new URLSearchParams(inFocus.search);
      expect(q.get("focus")).toBe("1");
      expect(q.get("case")).toBe(CASE);
      expect(q.get("view")).toBe(group.id);
      expect(q.get("sub")).toBe(sub.id);
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-focus-shell]")).toHaveCount(0);
      const back = await shown(page);
      expect(back).toMatchObject({
        caseId: CASE,
        group: group.id,
        sub: sub.id,
        focus: false,
      });
      expect(new URLSearchParams(back.search).has("focus")).toBe(false);
    });

test("a Focus link opens the stage on its case, group and sub-view, and the exit button leaves it", async ({
  page,
}) => {
  await page.goto(search("transport", "monitor", "&focus=1"));
  await expect(page.locator("[data-focus-shell]")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  expect(await shown(page)).toMatchObject({
    caseId: CASE,
    group: "transport",
    sub: "monitor",
    focus: true,
  });
  await page.locator("[data-focus-exit]").click();
  await expect(page.locator("[data-focus-shell]")).toHaveCount(0);
  expect(await shown(page)).toMatchObject({
    caseId: CASE,
    group: "transport",
    sub: "monitor",
    focus: false,
  });
});

test("Focus keeps the edited design and the operating point, and the rail acts on them", async ({
  page,
}) => {
  await page.goto(search("airflow", "primary"));
  await balanced(page);
  const speed = page.locator('.caos-knob[data-control="speed"] input');
  await speed.fill("0.8");
  await balanced(page);
  await page.locator("[data-focus-enter]").click();
  await expect(page.locator("[data-focus-shell]")).toBeVisible();
  await expect(
    page.locator('.caos-focus-rail .caos-knob[data-control="speed"] input'),
  ).toHaveValue("0.8");
  await page
    .locator('.caos-focus-rail .caos-knob[data-control="speed"] input')
    .fill("0.6");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-focus-shell]")).toHaveCount(0);
  expect((await project(page)).options.speed).toBe(0.6);
});

test("the Context view is the write-up of the selected network, with its references last", async ({
  page,
}) => {
  await page.goto(search("context"));
  const context = page.locator(".caos-cw-context");
  await expect(context).toBeVisible();
  await expect(context.getByRole("heading", { name: "The problem" })).toBeVisible();
  await expect(context.getByRole("heading", { name: "Formalization" })).toBeVisible();
  await expect(context.getByRole("heading", { name: "What each regime shows" })).toBeVisible();
  const blocks = page.locator("[data-doc-references]");
  await expect(blocks).toHaveCount(1);
  const last = await blocks.evaluate((block) => {
    const scope = block.closest('[role="tabpanel"]')!;
    for (let el: Element | null = block; el && el !== scope; el = el.parentElement)
      for (let n = el.nextElementSibling; n; n = n.nextElementSibling)
        if ((n as HTMLElement).offsetParent !== null) return false;
    return true;
  });
  expect(last).toBe(true);
});

test("each operating control of the rail moves the selection key, and the readouts follow it", async ({
  page,
}) => {
  await page.goto(search("airflow", "primary"));
  await balanced(page);
  const key = () =>
    page.locator("[data-case-workbench]").getAttribute("data-state-key");
  const k0 = await key();
  await page.locator('.caos-knob[data-control="speed"] input').fill("0.9");
  await expect.poll(key).not.toBe(k0);
  const k1 = await key();
  await page.locator('.caos-knob[data-control="resistance"] input').fill("1.5");
  await expect.poll(key).not.toBe(k1);
  const k2 = await key();
  await page
    .locator('[data-control="airway-state"] button[role=radio]')
    .filter({ hasText: "Closed" })
    .click();
  await expect.poll(key).not.toBe(k2);
  await balanced(page);
  await railSection(page, "readouts");
  const stale = await page.locator("[data-readout][data-stale='1']").count();
  expect(stale).toBe(0);
  const readoutKeys = await page
    .locator("[data-readout]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-state-key")));
  expect(readoutKeys.length).toBeGreaterThan(0);
  for (const k of readoutKeys) expect(k).toBe(await key());
});

test("the rail shows Setpoint, Values and Project one at a time, without scrolling at 1280 by 800", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openWorkbench(page);
  const sections = page.locator(".caos-wb-rail-sections [role=tab]");
  await expect(sections).toHaveText(["Setpoint", "Values", "Project"]);
  for (let i = 0; i < 3; i++) {
    await sections.nth(i).click();
    const fit = await page.locator(".caos-wb-rail").evaluate((rail) => ({
      scroll: rail.scrollHeight,
      client: rail.clientHeight,
    }));
    expect(fit.scroll, `section ${i}`).toBeLessThanOrEqual(fit.client + 1);
  }
});

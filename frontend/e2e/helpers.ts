import { expect, test as base, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Network, Options } from "../src/contracts";
import type { ProjectInputs } from "../src/storage";

export const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const failures: string[] = [];
      page.on("pageerror", (error) => failures.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") failures.push(message.text());
      });
      await use();
      expect(
        failures,
        "The workflow must not emit browser runtime errors",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export const defaults: Options = {
  speed: 1,
  resistanceScale: 1,
  overrides: {},
};
export const label = (en: string) => ({ en, es: en });
export function analyticalNetwork(): Network {
  return {
    schema: "aerovia.network/v1",
    id: "browser-analytical",
    name: label("Analytical browser network"),
    description: label(
      "Authored fixture: 100 Pa fan, 1 Pa s2/m6 resistance, 100 m3 volume.",
    ),
    provenance: {
      kind: "authored",
      source: "Browser verification fixture",
      license: "Apache-2.0",
    },
    nodes: [
      { id: "a", x: 0, y: 0, z: 0, boundary: 0 },
      { id: "b", x: 10, y: 0, z: 0, boundary: 0 },
    ],
    edges: [
      {
        id: "ab",
        from: "a",
        to: "b",
        name: label("Analytical fan airway"),
        kind: "fan",
        area: 10,
        resistance: 1,
        target: 0,
        level: 0,
        fan: { pressure: 100, coefficient: 0, efficiency: 0.8 },
      },
    ],
  };
}
export async function balanced(page: Page, language = "en") {
  await expect(page.locator(".av-viz-readout")).toContainText(
    language === "es" ? "Balance de flujo resuelto" : "Flow balance solved",
  );
}
export async function openWorkbench(page: Page) {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await balanced(page);
}
export async function mode(page: Page, name: string) {
  await page.getByRole("tab", { name, exact: true }).click();
  await toolSection(page, "primary");
}
export async function toolSection(page: Page, section: string) {
  await parameters(page);
  await page
    .getByRole("combobox", {
      name: /^(Tool section|Sección de herramientas)$/,
      exact: true,
    })
    .selectOption(section);
}
export async function modelSection(page: Page, section: string) {
  await toolSection(page, "primary");
  await page
    .getByRole("combobox", {
      name: /^(Model section|Sección del modelo)$/,
      exact: true,
    })
    .selectOption(section);
}
export async function parameters(page: Page) {
  const controls = page.locator(".av-controls");
  if (!(await controls.isVisible()))
    await page
      .getByRole("button", { name: /Show tool parameters|Mostrar parámetros/ })
      .click();
  await expect(controls).toBeVisible();
}
export async function numeric(page: Page, name: string, value: number) {
  const input = page.getByRole("spinbutton", { name, exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}
export async function downloaded<T>(page: Page, button: string): Promise<T> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  const file = await pending;
  return JSON.parse(await readFile((await file.path())!, "utf8")) as T;
}
export const project = (page: Page) => downloaded<ProjectInputs>(page, "Save");
export async function importProject(
  page: Page,
  network: Network,
  options: Options = defaults,
) {
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByLabel(/Saved project or network JSON/).setInputFiles({
    name: "verification-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schema: "aerovia.project/v1",
        network,
        options,
        savedAt: "2026-09-10T00:00:00Z",
      }),
    ),
  });
  await expect(page.getByRole("dialog")).toBeHidden();
  await balanced(page);
}
export const uiNumber = (text: string) =>
  Number.parseFloat(text.replace(/,/g, ""));
export async function noDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
}

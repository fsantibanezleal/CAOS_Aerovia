import {
  test,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

type Language = "en" | "es";
type Theme = "dark" | "light";
const appearances: { language: Language; theme: Theme }[] = [
  { language: "en", theme: "dark" },
  { language: "en", theme: "light" },
  { language: "es", theme: "dark" },
  { language: "es", theme: "light" },
];

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function open(page: Page, language: Language, theme: Theme) {
  await page.goto("/");
  await expect(page.getByTestId("solver-status")).toHaveText(
    "Network balanced",
  );
  if (theme === "light")
    await page
      .getByRole("button", { name: "Toggle theme", exact: true })
      .click();
  if (language === "es")
    await page
      .getByRole("button", { name: "Change language", exact: true })
      .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function noDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight);
}

async function capture(page: Page, info: TestInfo, name: string) {
  await noDocumentOverflow(page);
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    animations: "disabled",
  });
}

/** Scroll the app's own panel, keeping the document itself fixed in the viewport. */
async function reveal(target: Locator, panelSelector: string) {
  await target.evaluate((element, selector) => {
    const panel = element.closest(selector);
    if (!(panel instanceof HTMLElement))
      throw new Error(`Missing scroll panel: ${selector}`);
    const offset =
      element.getBoundingClientRect().top - panel.getBoundingClientRect().top;
    panel.scrollTop += offset - 20;
  }, panelSelector);
  await expect(target).toBeVisible();
}

for (const { language, theme } of appearances) {
  const localized = (en: string, es: string) => (language === "en" ? en : es);

  test(`Evidence subtabs and computed analysis remain readable in ${language} ${theme}`, async ({
    page,
  }, info) => {
    const errors = watchErrors(page);
    await open(page, language, theme);
    await page
      .getByRole("button", {
        name: localized("Evidence", "Evidencia"),
        exact: true,
      })
      .click();
    const tabs = [
      {
        id: "use",
        name: localized("Use the workbench", "Usar la herramienta"),
        heading: localized(
          "An intervention, traced through the mine",
          "Una intervención, seguida por toda la mina",
        ),
      },
      {
        id: "physics",
        name: localized("Physics & limits", "Física y límites"),
        heading: localized(
          "Pressure drives a conserved network flow",
          "La presión impulsa un flujo conservado",
        ),
      },
      {
        id: "data",
        name: localized("Your data", "Sus datos"),
        heading: localized(
          "Your network stays on your computer",
          "Su red permanece en su equipo",
        ),
      },
      {
        id: "verification",
        name: localized("Verification", "Verificación"),
        heading: localized(
          "Evidence you can reproduce",
          "Evidencia reproducible",
        ),
      },
    ];
    for (const tab of tabs) {
      await page.locator(".evidence").evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.getByRole("button", { name: tab.name, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: tab.heading, exact: true }),
      ).toBeVisible();
      await capture(page, info, `evidence-${tab.id}-top`);
      if (tab.id === "verification") {
        await expect(page.locator(".evidence details")).not.toHaveAttribute(
          "open",
          "",
        );
        const metrics = page.locator(".evidence .analysis-grid");
        await expect(metrics.locator(".analysis-card")).toHaveCount(4);
        await reveal(metrics, ".evidence");
        await capture(page, info, "evidence-verification-metrics");
        await page.locator(".evidence summary").click();
        await expect(page.locator(".evidence pre")).toContainText(
          '"device": "cuda"',
        );
        await reveal(page.locator(".evidence pre"), ".evidence");
        await capture(page, info, "evidence-verification-raw-record");
        await page.locator(".evidence summary").click();
      }
      await reveal(page.locator(".evidence article > p").last(), ".evidence");
      await capture(page, info, `evidence-${tab.id}-bottom`);
    }

    await page
      .getByRole("button", {
        name: localized("Analysis", "Análisis"),
        exact: true,
      })
      .click();
    const actionPanel = page.locator(".analysis-actions");
    await actionPanel
      .getByRole("button", {
        name: localized(
          "Calculate operating envelope",
          "Calcular envolvente operativa",
        ),
        exact: true,
      })
      .click();
    const envelope = page.getByRole("heading", {
      name: localized(
        "Common-speed operating envelope",
        "Envolvente de velocidad común",
      ),
      exact: true,
    });
    await expect(envelope).toBeVisible();
    await actionPanel
      .getByRole("button", {
        name: localized("Rank resistance sensitivity", "Ordenar sensibilidad"),
        exact: true,
      })
      .click();
    await expect(page.locator(".sensitivity-list > button")).toHaveCount(12);
    await expect(page.locator(".uncertainty .intervals > button")).toHaveCount(
      12,
    );

    const panels = [
      { id: "energy", target: page.locator(".big-energy") },
      {
        id: "fan-operating-point",
        target: page.getByRole("heading", {
          name: localized(
            "Fan operating point",
            "Punto de operación del ventilador",
          ),
          exact: true,
        }),
      },
      { id: "operating-envelope", target: envelope },
      {
        id: "sensitivity",
        target: page
          .locator(".analysis-card")
          .filter({ has: page.locator(".sensitivity-list") }),
      },
      { id: "resistance-intervals", target: page.locator(".uncertainty") },
    ];
    for (const panel of panels) {
      await reveal(panel.target, ".analysis-page");
      await capture(page, info, `analysis-${panel.id}`);
    }
    await reveal(page.locator(".uncertainty .percentiles"), ".analysis-page");
    await capture(page, info, "analysis-uncertainty-power-and-scope");
    expect(errors).toEqual([]);
  });

  for (const mobile of [false, true]) {
    test(`Architecture modal keyboard and focus ${mobile ? "mobile" : "desktop"} ${language} ${theme}`, async ({
      page,
    }, info) => {
      const errors = watchErrors(page);
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await open(page, language, theme);
      const trigger = page.getByRole("button", {
        name: localized("App architecture", "Arquitectura de la aplicación"),
        exact: true,
      });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const modal = page.getByRole("dialog", {
        name: localized("How Aerovia works", "Cómo funciona Aerovia"),
        exact: true,
      });
      const close = modal.getByRole("button", {
        name: "Close / Cerrar",
        exact: true,
      });
      const guide = modal.getByRole("link", {
        name: localized(
          "Architecture, contracts and reproduction guides",
          "Arquitectura, contratos y guías de reproducción",
        ),
        exact: true,
      });
      await expect(modal).toBeVisible();
      await expect(close).toBeFocused();
      await expect(modal.locator(".architecture-node")).toHaveCount(6);
      const bounds = await modal.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      await capture(page, info, "architecture-top");
      if (mobile) {
        await reveal(
          modal.locator(".architecture-map > section").nth(1),
          "dialog",
        );
        await expect(
          modal.locator(".architecture-map > section").nth(1),
        ).toBeInViewport({ ratio: 0.8 });
        await capture(page, info, "architecture-offline-path");
      }
      await page.keyboard.press("Shift+Tab");
      await expect(guide).toBeFocused();
      await guide.scrollIntoViewIfNeeded();
      await capture(page, info, "architecture-boundaries-and-guides");
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden();
      await expect(trigger).toBeFocused();
      await noDocumentOverflow(page);
      expect(errors).toEqual([]);
    });
  }
}

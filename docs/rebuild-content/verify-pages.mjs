import { chromium } from "../../frontend/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const appUrl = (process.env.AEROVIA_QA_URL ?? "http://127.0.0.1:5908").replace(
  /\/$/,
  "",
);
const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(root, "build/local/companion-review");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const records = [];
const problems = [];
async function reviewNativeArchitecture({
  dialog,
  page,
  size,
  lang,
  theme,
  index,
}) {
  if (size.name !== "mobile") return;
  await dialog
    .getByRole("button", {
      name: lang === "en" ? "Read at full size" : "Leer a tamaño completo",
      exact: true,
    })
    .click();
  const region = dialog.getByRole("region", {
    name: lang === "en" ? "Architecture diagram" : "Diagrama de arquitectura",
    exact: true,
  });
  await region.scrollIntoViewIfNeeded();
  const dimensions = await region.evaluate((el) => ({
    client: el.clientWidth,
    scroll: el.scrollWidth,
    svg: el.querySelector("svg").getBoundingClientRect().width,
  }));
  if (dimensions.svg < 760 || dimensions.scroll <= dimensions.client)
    problems.push({
      size: size.name,
      lang,
      theme,
      route: "architecture",
      index,
      reason: "native diagram did not expand inside contained scrolling",
      dimensions,
    });
  for (const side of ["left", "right"]) {
    await region.evaluate((el, side) => {
      el.scrollLeft = side === "left" ? 0 : el.scrollWidth;
    }, side);
    const file = `${size.name}-${lang}-${theme}-architecture-${index}-native-${side}.png`;
    await page.screenshot({ path: path.join(out, file) });
    records.push({
      size: size.name,
      lang,
      theme,
      route: "architecture",
      index,
      file,
      dimensions,
    });
  }
  await dialog
    .getByRole("button", {
      name: lang === "en" ? "Fit diagram" : "Ajustar diagrama",
      exact: true,
    })
    .click();
}
for (const size of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
])
  for (const lang of ["en", "es"])
    for (const theme of ["dark", "light"]) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
      });
      await context.addInitScript(
        ({ lang, theme }) => {
          localStorage.setItem("caos.lang", lang);
          localStorage.setItem("caos.theme", theme);
        },
        { lang, theme },
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      for (const route of [
        "introduction",
        "methodology",
        "implementation",
        "experiments",
        "benchmark",
      ]) {
        await page.goto(`${appUrl}/${route}`, { waitUntil: "networkidle" });
        await page.locator(".av-doc-scroll h1").waitFor();
        const tabs = page.locator(".av-doc-scroll .subtablist [role=tab]");
        const count = await tabs.count();
        for (let i = 0; i < Math.max(count, 1); i++) {
          if (count) {
            await tabs.nth(i).click();
            await page.locator(".av-doc-scroll").evaluate((el) => {
              el.scrollTop = 0;
            });
          }
          const label = count ? await tabs.nth(i).innerText() : "overview";
          if (route === "benchmark" && i === 0 && size.name === "desktop") {
            const button = page.getByRole("button", {
              name:
                lang === "en"
                  ? "Run exact local calculation"
                  : "Ejecutar cálculo exacto local",
              exact: true,
            });
            if (await button.count()) {
              await button.click();
              await page.locator(".av-doc-scroll").evaluate((el) => {
                el.scrollTop = 0;
              });
            }
          }
          const metrics = await page.evaluate(() => {
            const d = document.documentElement;
            const body = document.querySelector(".av-doc-scroll");
            const active =
              body.querySelector("[role=tabpanel]:not([hidden])") ?? body;
            return {
              width: innerWidth,
              height: innerHeight,
              scrollWidth: d.scrollWidth,
              scrollHeight: d.scrollHeight,
              docWidth: body.clientWidth,
              docScrollWidth: body.scrollWidth,
              wordCount: active.innerText.split(/\s+/).filter(Boolean).length,
              paragraphs: active.querySelectorAll("p").length,
              equations: active.querySelectorAll(".equation").length,
              katexErrors: [...active.querySelectorAll(".katex-error")].map(
                (e) => e.textContent,
              ),
              svg: active.querySelectorAll("svg").length,
            };
          });
          const file = `${size.name}-${lang}-${theme}-${route}-${i}.png`;
          await page.screenshot({ path: path.join(out, file) });
          records.push({
            size: size.name,
            lang,
            theme,
            route,
            tab: label,
            file,
            metrics,
          });
          if (
            metrics.scrollWidth !== metrics.width ||
            metrics.scrollHeight !== metrics.height ||
            metrics.docScrollWidth > metrics.docWidth + 2 ||
            metrics.katexErrors.length
          )
            problems.push({
              size: size.name,
              lang,
              theme,
              route,
              tab: label,
              metrics,
            });
          const figures = page.locator(".av-doc-scroll .av-scientific-figure");
          for (let j = 0; j < (await figures.count()); j++) {
            const figure = figures.nth(j);
            await figure.scrollIntoViewIfNeeded();
            const view = figure.locator(".av-diagram-viewport");
            if (size.name === "mobile")
              await figure
                .getByRole("button", {
                  name:
                    lang === "en"
                      ? "Read at full size"
                      : "Leer a tamaño completo",
                  exact: true,
                })
                .click();
            const issues = await figure.locator("svg").evaluate((svg) => {
              const vb = svg.viewBox.baseVal;
              return [...svg.querySelectorAll("text")].flatMap((t) => {
                const b = t.getBBox();
                return b.x < 0 ||
                  b.y < 0 ||
                  b.x + b.width > vb.width + 0.2 ||
                  b.y + b.height > vb.height + 0.2
                  ? [
                      {
                        text: t.textContent,
                        x: b.x,
                        y: b.y,
                        width: b.width,
                        height: b.height,
                      },
                    ]
                  : [];
              });
            });
            const figureFile = `${size.name}-${lang}-${theme}-${route}-${i}-figure-${j}.png`;
            await page.screenshot({ path: path.join(out, figureFile) });
            records.push({
              size: size.name,
              lang,
              theme,
              route,
              tab: label,
              figure: j,
              file: figureFile,
              issues,
            });
            if (issues.length)
              problems.push({
                size: size.name,
                lang,
                theme,
                route,
                tab: label,
                figure: j,
                issues,
              });
            if (size.name === "mobile") {
              await view.evaluate((el) => {
                el.scrollLeft = el.scrollWidth;
              });
              const rightFile = figureFile.replace(".png", "-right.png");
              await page.screenshot({ path: path.join(out, rightFile) });
              records.push({
                size: size.name,
                lang,
                theme,
                route,
                tab: label,
                figure: j,
                file: rightFile,
              });
              await figure
                .getByRole("button", {
                  name: lang === "en" ? "Fit diagram" : "Ajustar diagrama",
                  exact: true,
                })
                .click();
            }
          }
        }
      }
      // Real shell trigger, real tab clicks, and a verified language on the diagram parent.
      await page
        .getByRole("button", {
          name:
            lang === "en"
              ? "Architecture / How it works"
              : "Arquitectura / Cómo funciona",
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      const archTabs = dialog.getByRole("tab");
      for (let i = 0; i < (await archTabs.count()); i++) {
        await archTabs.nth(i).click();
        await dialog.locator("svg.arch-svg").waitFor();
        const attr = await dialog
          .locator("[data-arch-lang]")
          .getAttribute("data-arch-lang")
          .catch(() => null);
        const file = `${size.name}-${lang}-${theme}-architecture-${i}.png`;
        await page.screenshot({ path: path.join(out, file) });
        records.push({
          size: size.name,
          lang,
          theme,
          route: "architecture",
          tab: await archTabs.nth(i).innerText(),
          file,
          language: attr,
        });
        if (attr !== lang)
          problems.push({
            route: "architecture",
            reason: "diagram language not confirmed",
            lang,
            attr,
          });
        await dialog.locator("svg.arch-svg").scrollIntoViewIfNeeded();
        const diagramFile = file.replace(".png", "-figure.png");
        await page.screenshot({ path: path.join(out, diagramFile) });
        records.push({
          size: size.name,
          lang,
          theme,
          route: "architecture",
          tab: await archTabs.nth(i).innerText(),
          file: diagramFile,
          language: attr,
        });
        await reviewNativeArchitecture({
          dialog,
          page,
          size,
          lang,
          theme,
          index: i,
        });
      }
      await page.keyboard.press("Escape");
      if (errors.length)
        problems.push({ size: size.name, lang, theme, errors });
      await context.close();
    }
await browser.close();
await writeFile(
  path.join(out, "review.json"),
  JSON.stringify({ records, problems }, null, 2) + "\n",
);
console.log(
  JSON.stringify({ captures: records.length, problems, out }, null, 2),
);
if (problems.length) process.exitCode = 1;

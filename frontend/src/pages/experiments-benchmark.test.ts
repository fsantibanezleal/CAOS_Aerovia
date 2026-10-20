import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { useLangStore } from "@fasl-work/caos-app-shell";
import { validateCatalog, type CatalogArtifact } from "../content/artifacts";
import type { ScienceArtifact } from "../learned";
import { DeepSection } from "../content/primitives";
import { experimentSections } from "../content/experiments";
import { DatasetTables } from "./Experiments";
import {
  ComparisonLimits,
  NumericalEvidence,
  ProvenanceEvidence,
  RobustnessEvidence,
  UncertaintyEvidence,
} from "./Benchmark";
import { HeldoutLive, ReferenceLive } from "../content/BenchmarkTools";
import MatrixHeatmap from "../content/MatrixHeatmap";
import { benchmarkSectionRefs } from "../content/citations/benchmark";

// The content contract of the Experiments and Benchmark pages at their ADR-0017 section 2.1 floors (shell 0.15.0,
// gate/areas.mjs), in both languages, from the committed artifacts under data/artifacts. A server render does not run the
// shell's layout effects or the chart's resize observer, so the chart host (`caos-bars`) and the section markers are what
// is asserted here; the pointer reach, the drawn charts and the references block are measured on the built site by
// frontend/e2e/experiments-benchmark.spec.ts and by the shell gate.
type Lang = "en" | "es";
const read = (name: string) =>
  readFileSync(
    new URL(`../../../data/artifacts/${name}`, import.meta.url),
    "utf8",
  );
const catalog: CatalogArtifact = validateCatalog(
  JSON.parse(read("catalog.json")),
);
const science = JSON.parse(read("science.json")) as ScienceArtifact;
/**
 * A server render reads the language store through its server snapshot, which zustand takes from `getInitialState()` and
 * `setState` never touches: set both, or a "Spanish" render is English.
 */
const setLang = (lang: Lang) => {
  useLangStore.setState({ lang });
  (useLangStore.getInitialState() as { lang: Lang }).lang = lang;
};
const render = (
  node: Parameters<typeof renderToStaticMarkup>[0],
  lang: Lang,
) => {
  setLang(lang);
  return renderToStaticMarkup(node);
};
const count = (html: string, needle: RegExp) =>
  (html.match(needle) ?? []).length;
const LANGS: Lang[] = ["en", "es"];

/** The text a reader sees, minus what the gate's G11 skips: formulas, code, SVG and anything marked translate="no". */
function readable(html: string): string {
  const skipTags = new Set(["svg", "code", "pre", "script", "style"]);
  const void_ = new Set(["br", "hr", "img", "input", "meta", "link", "path"]);
  const stack: boolean[] = [];
  let skipDepth = 0;
  let out = "";
  let last = 0;
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    if (skipDepth === 0) out += html.slice(last, m.index);
    last = m.index + m[0].length;
    const [, close, tag, attrs, self] = m;
    if (close) {
      const wasSkip = stack.pop();
      if (wasSkip) skipDepth--;
    } else if (!void_.has(tag.toLowerCase()) && !self) {
      const skip =
        skipTags.has(tag.toLowerCase()) ||
        /translate="no"/.test(attrs) ||
        /class="[^"]*\bkatex\b/.test(attrs);
      stack.push(skip);
      if (skip) skipDepth++;
    }
    if (skipDepth === 0) out += " ";
  }
  return out;
}

/**
 * The numbers a Spanish page writes with a decimal point: the gate's G11 rule (gate/inpage.mjs G.decimals), except that a
 * number with an exponent never passes as a thousands group ("5.684e-14" is a decimal; the gate lets it through because
 * its mantissa reads as a group of three digits).
 */
function pointDecimals(text: string): string[] {
  const out: string[] = [];
  const re = /(?<![\w.,/:@#])(\d+)\.(\d+)(?:[eE][-+]?\d+)?(?![\w/@]|\.\d)/g;
  for (const m of text.matchAll(re)) {
    const token = text.slice(m.index).match(/^\d+(?:\.\d+)+/)?.[0] ?? m[0];
    if (!/[eE]/.test(m[0]) && /^[1-9]\d{0,2}(\.\d{3})+$/.test(token)) continue;
    out.push(text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 5));
  }
  return out;
}

beforeEach(() => setLang("en"));

describe("Experiments", () => {
  const protocol = experimentSections.find(
    (s) => s.id === "learning-protocol",
  )!;
  const holdout = science.benchmark.familyHoldout!;

  it.each(LANGS)(
    "the protocol figure is captioned from the committed held-out split by network (%s)",
    (lang) => {
      expect(protocol.area).toBe("protocol");
      expect(protocol.diagram).toBe("split");
      expect(protocol.diagramCaption).toBeDefined();
      const html = render(
        createElement(DeepSection, { section: protocol }),
        lang,
      );
      expect(count(html, /<figcaption/g)).toBe(1);
      const caption = html.match(
        /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/,
      )![1];
      // every number and identifier in the caption is a field of science.json benchmark.familyHoldout
      expect(caption).toContain(String(holdout.trainingCaseIds.length));
      expect(caption).toContain(holdout.excludedCaseIds[0]);
      expect(caption).toContain(
        lang === "en" ? "room-and-pillar" : "cámaras y pilares",
      );
      expect(caption.toLowerCase()).toContain(
        lang === "en" ? "forbidden" : "prohibido",
      );
      // the forbidden anti-pattern is drawn in the figure itself
      expect(html).toContain(
        lang === "en"
          ? "Forbidden: use test outcomes"
          : "Prohibido: usar resultados de prueba",
      );
      expect(html).toContain("<svg");
    },
  );

  it.each(LANGS)(
    "every area meets its floor: questions, metrics, protocol, datasets (%s)",
    (lang) => {
      const byArea = (area: string) =>
        experimentSections.filter((s) => s.area === area);
      const dense = (s: (typeof experimentSections)[number]) =>
        s.paragraphs.filter(
          (p) => p[lang === "en" ? 0 : 1].trim().split(/\s+/).length >= 40,
        ).length;
      expect(byArea("question").length).toBeGreaterThanOrEqual(1);
      for (const s of byArea("question"))
        expect(dense(s), s.id).toBeGreaterThanOrEqual(2);
      expect(
        byArea("metrics").reduce((n, s) => n + s.equations.length, 0),
      ).toBeGreaterThanOrEqual(2);
      expect(experimentSections.length).toBeGreaterThanOrEqual(6);
      const html = render(
        createElement(DatasetTables, { data: catalog }),
        lang,
      );
      expect(count(html, /<table/g)).toBeGreaterThanOrEqual(1);
      expect(count(html, /<tr>\s*<th scope="row">/g)).toBe(
        catalog.cases.length,
      );
    },
  );

  it("marks every licence identifier translate=no in the Spanish table (G11)", () => {
    const html = render(createElement(DatasetTables, { data: catalog }), "es");
    const licences = new Set(
      catalog.cases.map((c) => c.network.provenance.license),
    );
    for (const licence of licences) {
      expect(
        count(
          html,
          new RegExp(licence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        ),
      ).toBeGreaterThan(0);
      expect(html).toContain(`<span translate="no">${licence}</span>`);
    }
    expect(pointDecimals(readable(html))).toEqual([]);
  });
});

describe("Benchmark", () => {
  const nodes = {
    numerical: () => createElement(NumericalEvidence, { catalog }),
    robustness: () => createElement(RobustnessEvidence, { science, catalog }),
    uncertainty: () => createElement(UncertaintyEvidence, { catalog }),
    provenance: () => createElement(ProvenanceEvidence, { science, catalog }),
    limits: () => createElement(ComparisonLimits),
    heldout: () => createElement(HeldoutLive, { science, catalog }),
    reference: () => createElement(ReferenceLive, { catalog }),
  };

  it.each(LANGS)(
    "robustness declares a chart of the committed degradation curve (%s)",
    (lang) => {
      const html = render(nodes.robustness(), lang);
      expect(html).toContain('data-area="robustness"');
      expect(count(html, /class="caos-bars"/g)).toBeGreaterThanOrEqual(1);
      // the table of the same curve stays: one row per committed (method, sigma)
      const rows = science.benchmark.degradation!;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(html).toContain(`>${row.samples}</td>`);
    },
  );

  it.each(LANGS)(
    "uncertainty shows a visible table or chart of the committed ensemble (%s)",
    (lang) => {
      const html = render(nodes.uncertainty(), lang);
      expect(html).toContain('data-area="results"');
      const outsideDetails = html.replace(/<details[\s\S]*?<\/details>/g, "");
      expect(
        count(outsideDetails, /<table/g) +
          count(outsideDetails, /class="caos-bars"/g),
      ).toBeGreaterThanOrEqual(1);
      // the quantile table of the selected case keeps its three quantiles and its target
      expect(html).toContain("p05");
      expect(html).toContain("p95");
    },
  );

  it.each(LANGS)(
    "the held-out tool is the live area with registered controls (%s)",
    (lang) => {
      const html = render(nodes.heldout(), lang);
      expect(html).toContain('data-area="live"');
      expect(count(html, /data-control="/g)).toBeGreaterThanOrEqual(2);
      expect(html).not.toContain("th-refs");
      expect(html).toContain(`data-refs="${3}"`);
    },
  );

  it.each(LANGS)(
    "the reference tool draws no inline references row (%s)",
    (lang) => {
      const html = render(nodes.reference(), lang);
      expect(html).toContain("data-doc-section");
      expect(html).not.toContain("th-refs");
      expect(html).toContain('data-refs="2"');
    },
  );

  it.each(LANGS)(
    "the limits of the comparison are exactly one honest callout (%s)",
    (lang) => {
      const html = render(nodes.limits(), lang);
      expect(html).toContain('data-area="caveat"');
      expect(count(html, /data-callout="honest"/g)).toBe(1);
      expect(count(html, /data-callout="strong"/g)).toBe(0);
      // transcribed from sentences the page already carries (the lede and the comparison and provenance texts)
      expect(html).toContain(
        lang === "en"
          ? "authored engineering scenarios"
          : "escenarios de ingeniería creados",
      );
      expect(html).toContain(
        lang === "en" ? "no measured mine data" : "no datos medidos de mina",
      );
    },
  );

  it("registers every section's references with the page block", () => {
    expect(Object.keys(benchmarkSectionRefs).sort()).toEqual(
      [
        "heldout",
        "limits",
        "matrix",
        "numerical",
        "provenance",
        "reference",
        "robustness",
        "uncertainty",
      ].sort(),
    );
  });

  it.each(LANGS)(
    "writes no decimal point or untranslated version in Spanish tables (%s)",
    (lang) => {
      for (const key of [
        "numerical",
        "robustness",
        "uncertainty",
        "provenance",
      ] as const) {
        const html = render(nodes[key](), lang);
        if (lang === "es")
          expect(pointDecimals(readable(html)), key).toEqual([]);
      }
      const numerical = render(nodes.numerical(), "en");
      expect(numerical).toContain('translate="no"');
    },
  );

  it.each(LANGS)(
    "the error map keeps its row headers out of the way of the cell buttons (%s)",
    (lang) => {
      const html = render(
        createElement(MatrixHeatmap, {
          science,
          catalog,
          methodId: "topology-mlp",
          selectedCase: "all",
          selectedRegime: "all",
          onSelect: () => undefined,
        }),
        lang,
      );
      const cells = count(html, /<button[^>]*aria-pressed/g);
      expect(cells).toBeGreaterThan(0);
      // every row header, and the corner, release the sticky left edge that covered the first column (G5)
      const rowHeaders = html.match(/<th scope="row"[^>]*>/g) ?? [];
      expect(rowHeaders.length).toBe(catalog.cases.length);
      for (const th of rowHeaders) expect(th).toContain("position:static");
      expect(html).toMatch(/<th[^>]*style="left:auto"[^>]*>(Case|Caso)</);
    },
  );
});

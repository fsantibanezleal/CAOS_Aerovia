import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { DOC_AREAS, useLangStore } from "@fasl-work/caos-app-shell";
import executive from "../../../content/executive.json";
import { IntroductionPage, TOPIC_IDS } from "./Introduction";
import Methodology from "./Methodology";
import Implementation from "./Implementation";
import Experiments from "./Experiments";
import { DeepSection, type ScientificSection } from "../content/primitives";
import { introductionSections } from "../content/introduction";
import { classicalMethods } from "../content/methods";
import { learnedMethods } from "../content/learned-methods";
import { implementationSections } from "../content/implementation";
import { experimentSections } from "../content/experiments";

// The render contract of the documentation pages on the shell's DocPage and DocSection (shell 0.15.0). The shell draws the
// references block in a layout effect, which a server render does not run; the block's place at the end of each page or open
// topic is checked on the built site by frontend/e2e/documentation.spec.ts.
type Lang = "en" | "es";
const render = (
  node: Parameters<typeof renderToStaticMarkup>[0],
  lang: Lang = "en",
) => {
  useLangStore.setState({ lang });
  return renderToStaticMarkup(node);
};
const count = (html: string, needle: RegExp) =>
  (html.match(needle) ?? []).length;
const intro = (
  props: { initial?: "executive" | "technical"; topic?: string } = {},
  lang: Lang = "en",
) =>
  render(
    createElement(IntroductionPage, { data: executive, base: "/", ...props }),
    lang,
  );
const tabs = (html: string) =>
  [
    ...html.matchAll(
      /<button[^>]*role="tab"[^>]*aria-selected="(true|false)"[^>]*data-tab="([\w-]+)"/g,
    ),
  ].map((m) => [m[2], m[1]]);

beforeEach(() => useLangStore.setState({ lang: "en" }));

describe("the Introduction", () => {
  it.each(["en", "es"] as const)(
    "opens on the executive view, selected, first of two views (%s)",
    (lang) => {
      const html = intro({}, lang);
      expect(tabs(html).slice(0, 2)).toEqual([
        ["executive", "true"],
        ["technical", "false"],
      ]);
      expect(html).toContain('data-doc-page=""');
    },
  );

  it.each(["en", "es"] as const)(
    "shows no equation, glossary, section or area while the executive view is open (%s)",
    (lang) => {
      const html = intro({}, lang);
      expect(html).not.toContain("katex");
      expect(html).not.toContain("data-glossary");
      expect(html).not.toContain("data-doc-section");
      expect(html).not.toContain("data-area");
      expect(html).not.toContain('class="equation"');
    },
  );

  it("lists the five areas of the technical view as its topics, in order", () => {
    expect(TOPIC_IDS).toEqual(DOC_AREAS["/introduction"]);
    const html = intro({ initial: "technical" });
    expect(tabs(html).map(([id]) => id)).toEqual([
      "executive",
      "technical",
      ...TOPIC_IDS,
    ]);
  });

  it.each(["en", "es"] as const)(
    "renders each area with its floor content in the technical view (%s)",
    (lang) => {
      const rendered = Object.fromEntries(
        TOPIC_IDS.map((topic) => [
          topic,
          intro({ initial: "technical", topic }, lang),
        ]),
      );
      for (const topic of TOPIC_IDS) {
        expect(count(rendered[topic], /data-doc-section=""/g), topic).toBe(1);
        expect(rendered[topic], topic).toContain(`data-area="${topic}"`);
      }
      expect(
        count(rendered.problem, /<p class="measure">[^<]{200,}/g),
      ).toBeGreaterThanOrEqual(2);
      expect(
        count(rendered.principles, /<p class="measure">[^<]{200,}/g),
      ).toBeGreaterThanOrEqual(2);
      expect(count(rendered.math, /<dt>/g)).toBeGreaterThanOrEqual(10);
      expect(
        count(rendered.math, /class="equation-caption"/g),
      ).toBeGreaterThanOrEqual(1);
      const list = rendered.pipeline.match(/<ol>[\s\S]*?<\/ol>/g) ?? [];
      expect(list.length).toBe(1);
      expect(count(list[0] ?? "", /<li>/g)).toBeGreaterThanOrEqual(4);
      expect(count(rendered.honesty, /data-callout="honest"/g)).toBe(1);
      expect(
        TOPIC_IDS.reduce(
          (n, topic) => n + count(rendered[topic], /class="equation-caption"/g),
          0,
        ),
      ).toBeGreaterThanOrEqual(3);
      expect(
        TOPIC_IDS.reduce(
          (n, topic) => n + count(rendered[topic], /<figcaption/g),
          0,
        ),
      ).toBeGreaterThanOrEqual(1);
    },
  );

  it("keeps the lede at 35 words or more in both languages, and without an equation", () => {
    for (const lang of ["en", "es"] as const) {
      const lede = intro({}, lang).match(/<p class="lede">([\s\S]*?)<\/p>/)![1];
      expect(
        lede.replace(/<[^>]+>/g, "").split(/\s+/).length,
      ).toBeGreaterThanOrEqual(35);
      expect(lede).not.toContain("katex");
    }
  });
});

describe.each([
  ["Methodology", Methodology, "method", 6],
  ["Implementation", Implementation, null, 6],
  ["Experiments", Experiments, null, 6],
] as const)("the %s page", (_name, Page, singleArea, topics) => {
  it.each(["en", "es"] as const)(
    "sits on DocPage with a lede of 35 words or more and its first topic on DocSection (%s)",
    (lang) => {
      const html = render(createElement(Page), lang);
      expect(html).toContain('data-doc-page=""');
      expect(count(html, /data-doc-section=""/g)).toBeGreaterThanOrEqual(1);
      const lede = html
        .match(/<p class="lede">([\s\S]*?)<\/p>/)![1]
        .replace(/<[^>]+>/g, "");
      expect(lede.split(/\s+/).length).toBeGreaterThanOrEqual(35);
      if (singleArea) expect(html).toContain(`data-area="${singleArea}"`);
      expect(count(html, /role="tab"/g)).toBe(topics);
    },
  );

  it("draws no references row of its own inside a section", () => {
    const html = render(createElement(Page));
    expect(html).not.toContain("th-refs");
    expect(count(html, /<h1>/g)).toBe(1);
  });
});

describe("no content is lost: what each section holds is what DeepSection renders", () => {
  const all: ScientificSection[] = [
    ...introductionSections,
    ...classicalMethods,
    ...learnedMethods,
    ...implementationSections,
    ...experimentSections,
  ];
  it.each(["en", "es"] as const)(
    "renders every paragraph, equation, symbol, figure and the callout of its %s sections",
    (lang) => {
      expect(all.length).toBe(27);
      for (const section of all) {
        const html = render(createElement(DeepSection, { section }), lang);
        const where = `${lang} ${section.id}`;
        expect(
          count(html, /<p class="measure">/g),
          `${where}: paragraphs`,
        ).toBe(section.paragraphs.length);
        expect(
          count(html, /class="equation-caption"/g),
          `${where}: equations`,
        ).toBe(section.equations.length);
        expect(count(html, /<dt>/g), `${where}: glossary items`).toBe(
          section.symbols?.length ?? 0,
        );
        expect(count(html, /<dd>/g), `${where}: glossary definitions`).toBe(
          section.symbols?.length ?? 0,
        );
        expect(count(html, /<figure/g), `${where}: figure`).toBe(
          section.diagram ? 1 : 0,
        );
        expect(count(html, /<figcaption/g), `${where}: caption`).toBe(
          section.diagramCaption ? 1 : 0,
        );
        expect(count(html, /data-callout="honest"/g), `${where}: callout`).toBe(
          1,
        );
        expect(html, where).toContain(`data-area="${section.area}"`);
        expect(html, where).toContain(`id="content-${section.id}"`);
        if (section.kind)
          expect(html, where).toContain(`data-method-kind="${section.kind}"`);
        expect(html, where).toContain(`data-refs="${section.refs.length}"`);
      }
    },
  );
});

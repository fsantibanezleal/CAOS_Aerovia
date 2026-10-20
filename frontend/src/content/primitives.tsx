import {
  Callout,
  Cite,
  DocSection,
  Equation,
  Figure,
  Glossary,
  useShellLang,
  type BiText,
  type GlossaryEntry,
} from "@fasl-work/caos-app-shell";
import type { ReactNode } from "react";
import ScienceDiagram, { type DiagramKind } from "./ScienceDiagram";
import "./content.css";

export type Bilingual = readonly [en: string, es: string];
/** The kind of a Methodology section (shell 0.15.0, `data-method-kind`): the page needs at least two learned. */
export type MethodKind = "classical" | "learned";
export type ScientificSection = {
  id: string;
  title: Bilingual;
  /** The area this section covers, from the vocabulary of its page (the shell's DOC_AREAS, ADR-0017 section 2.1). */
  area: string;
  /** Methodology only: classical or learned. */
  kind?: MethodKind;
  paragraphs: readonly Bilingual[];
  equations: readonly { tex: string; caption: Bilingual }[];
  /** Symbol lines written `term: definition`; they render as the shell's glossary. */
  symbols?: readonly Bilingual[];
  assumption: Bilingual;
  refs: string[];
  diagram?: DiagramKind;
  diagramCaption?: Bilingual;
};
export const tr = (value: Bilingual, es: boolean) => value[es ? 1 : 0];
export const biText = (value: Bilingual): BiText => ({
  en: value[0],
  es: value[1],
});
/** A symbol line `term: definition` as a glossary entry, split at its first colon in each language. */
export function glossaryEntries(
  symbols: readonly Bilingual[],
): GlossaryEntry[] {
  const split = (line: string) => {
    const at = line.indexOf(": ");
    return at < 0
      ? { term: line, definition: line }
      : { term: line.slice(0, at), definition: line.slice(at + 2) };
  };
  return symbols.map(([en, es]) => {
    const a = split(en);
    const b = split(es);
    return {
      term: { en: a.term, es: b.term },
      definition: { en: a.definition, es: b.definition },
    };
  });
}
/**
 * The wrapper of a documentation page's body: it carries `av-doc-scroll`, the class the companion widgets' rules in
 * content.css hang on. aerovia.css gives that class `overflow: auto`, which made sense when it was the page's own scroller;
 * inside the shell's DocPage the page-body scrolls, and a second scroll box would stop the vertical sub-tab list from
 * sticking (gate G12). The inline `overflow: visible` keeps the rules and drops the box.
 */
export function DocBody({ children }: { children: ReactNode }) {
  return (
    <div className="av-doc-scroll" style={{ overflow: "visible" }}>
      {children}
    </div>
  );
}

/** A scientific section as the shell's DocSection: every element the gate counts lands inside it, and its references join the block at the end of the page or open topic. */
export function DeepSection({
  section,
  children,
}: {
  section: ScientificSection;
  children?: ReactNode;
}) {
  const es = useShellLang() === "es";
  return (
    <DocSection
      id={`content-${section.id}`}
      title={biText(section.title)}
      area={section.area}
      kind={section.kind}
      refs={section.refs}
    >
      {section.paragraphs.map((paragraph, index) => (
        <p className="measure" key={index}>
          {tr(paragraph, es)}{" "}
          {index === 0 && section.refs[0] ? (
            <Cite id={section.refs[0]} />
          ) : null}
        </p>
      ))}
      {section.equations.map((equation, index) => (
        <Equation
          key={index}
          tex={equation.tex}
          caption={tr(equation.caption, es)}
        />
      ))}
      {section.symbols && (
        <Glossary
          entries={glossaryEntries(section.symbols)}
          ariaLabel={{ en: "Symbols", es: "Símbolos" }}
        />
      )}
      {section.diagram && (
        <Figure
          caption={
            section.diagramCaption ? tr(section.diagramCaption, es) : undefined
          }
        >
          <div className="fig-svg wide">
            <ScienceDiagram kind={section.diagram} />
          </div>
        </Figure>
      )}
      <Callout
        variant="honest"
        title={es ? "Supuestos y límites" : "Assumptions and limits"}
      >
        <p>{tr(section.assumption, es)}</p>
      </Callout>
      {children}
    </DocSection>
  );
}

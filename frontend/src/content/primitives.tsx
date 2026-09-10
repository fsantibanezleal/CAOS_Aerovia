import {
  Callout,
  Cite,
  Equation,
  Refs,
  useShellLang,
} from "@fasl-work/caos-app-shell";
import type { ReactNode } from "react";
import ScienceDiagram, { type DiagramKind } from "./ScienceDiagram";
import "./content.css";

export type Bilingual = readonly [en: string, es: string];
export type ScientificSection = {
  id: string;
  title: Bilingual;
  paragraphs: readonly Bilingual[];
  equations: readonly { tex: string; caption: Bilingual }[];
  symbols?: readonly Bilingual[];
  assumption: Bilingual;
  refs: string[];
  diagram?: DiagramKind;
  diagramCaption?: Bilingual;
};
export const tr = (value: Bilingual, es: boolean) => value[es ? 1 : 0];
export function PageHeading({
  title,
  lede,
  children,
}: {
  title: Bilingual;
  lede: Bilingual;
  children?: ReactNode;
}) {
  const es = useShellLang() === "es";
  return (
    <div className="page-head">
      <h1>{tr(title, es)}</h1>
      <p className="lede">
        {tr(lede, es)} {children}
      </p>
    </div>
  );
}
export function DeepSection({
  section,
  children,
}: {
  section: ScientificSection;
  children?: ReactNode;
}) {
  const es = useShellLang() === "es";
  return (
    <section aria-labelledby={`content-${section.id}`}>
      <h2 id={`content-${section.id}`}>{tr(section.title, es)}</h2>
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
        <ul>
          {section.symbols.map((symbol, index) => (
            <li key={index}>{tr(symbol, es)}</li>
          ))}
        </ul>
      )}
      {section.diagram && (
        <figure className="fig-svg wide">
          <ScienceDiagram kind={section.diagram} />
          {section.diagramCaption && (
            <figcaption>{tr(section.diagramCaption, es)}</figcaption>
          )}
        </figure>
      )}
      <Callout
        variant="honest"
        title={es ? "Supuestos y límites" : "Assumptions and limits"}
      >
        <p>{tr(section.assumption, es)}</p>
      </Callout>
      {children}
      <Refs ids={section.refs} label={es ? "Referencias" : "References"} />
    </section>
  );
}

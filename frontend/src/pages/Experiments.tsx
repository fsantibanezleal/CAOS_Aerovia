import { InlineMath, SubTabs, useShellLang } from "@fasl-work/caos-app-shell";
import { DeepSection, PageHeading, tr } from "../content/primitives";
import { experimentSections } from "../content/experiments";
import { useCatalog } from "../content/artifacts";
import { caseQuestions, regimeDefinitions } from "../content/cases";

const tabLabels: Record<string, readonly [string, string]> = {
  datasets: ["Data", "Datos"],
  "regime-design": ["Regimes", "Regímenes"],
  "numerical-verification": ["Hydraulics", "Hidráulica"],
  "transport-verification": ["Transport", "Transporte"],
  "learning-protocol": ["Learning", "Aprendizaje"],
  "robustness-runtime": ["Robustness", "Robustez"],
};

export default function Experiments() {
  const es = useShellLang() === "es";
  const { data, loading, error } = useCatalog();
  return (
    <div className="page-body prose av-doc-scroll">
      <PageHeading
        title={["Experiments", "Experimentos"]}
        lede={[
          "The experiment design separates hydraulic verification, passive-transport conservation, approximation learning and runtime usability. Every result needs a source, input identity, metric definition and valid comparison. The bundled data are authored engineering cases; the coverage tables below do not claim independent surveyed mines or field calibration.",
          "El diseño separa verificación hidráulica, conservación de transporte, aprendizaje aproximado y usabilidad. Cada resultado necesita fuente, identidad, métrica y comparación válida. Los datos incluidos son casos de ingeniería creados; las tablas no afirman minas levantadas independientes ni calibración de terreno. Cada pregunta conserva sus límites.",
        ]}
      >
        <InlineMath
          tex={String.raw`\mathcal D=\mathcal D_{tr}\cup\mathcal D_{val}\cup\mathcal D_{te}`}
        />
      </PageHeading>
      <SubTabs
        orientation="vertical"
        ariaLabel={es ? "Preguntas experimentales" : "Experimental questions"}
        tabs={experimentSections.map((section) => ({
          id: section.id,
          label: tr(tabLabels[section.id] ?? section.title, es),
          content: (
            <DeepSection section={section}>
              {section.id === "datasets" && (
                <>
                  <h3>
                    {es ? "Biblioteca y permisos" : "Library and permissions"}
                  </h3>
                  {loading ? (
                    <p role="status">
                      {es
                        ? "Cargando registro verificado…"
                        : "Loading verified registry…"}
                    </p>
                  ) : error ? (
                    <p role="alert">
                      {es
                        ? "No se pudo cargar la evidencia:"
                        : "Evidence could not be loaded:"}{" "}
                      {error}
                    </p>
                  ) : (
                    data && (
                      <table>
                        <thead>
                          <tr>
                            <th>{es ? "Caso" : "Case"}</th>
                            <th>
                              {es ? "Uniones / galerías" : "Nodes / airways"}
                            </th>
                            <th>{es ? "Pregunta" : "Question"}</th>
                            <th>{es ? "Origen / uso" : "Source / use"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.cases.map((c) => (
                            <tr key={c.network.id}>
                              <th scope="row">
                                {c.network.name[es ? "es" : "en"]}
                              </th>
                              <td>
                                {c.network.nodes.length} /{" "}
                                {c.network.edges.length}
                              </td>
                              <td>
                                {caseQuestions[c.network.id]
                                  ? tr(caseQuestions[c.network.id].question, es)
                                  : c.network.description[es ? "es" : "en"]}
                              </td>
                              <td>
                                {es
                                  ? "Creado; incluido; cálculo local y evidencia."
                                  : "Authored; bundled; local computation and replay."}{" "}
                                {c.network.provenance.license}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  )}
                  <table>
                    <thead>
                      <tr>
                        <th>{es ? "Fuente externa" : "External source"}</th>
                        <th>{es ? "Redistribución" : "Redistribution"}</th>
                        <th>{es ? "Papel" : "Role"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>McPherson / SRK</td>
                        <td>
                          {es ? "Solo enlace al editor" : "Publisher link only"}
                        </td>
                        <td>
                          {es ? "Teoría de ventilación" : "Ventilation theory"}
                        </td>
                      </tr>
                      <tr>
                        <td>NIST / NIOSH / Clawpack</td>
                        <td>
                          {es
                            ? "Referencias enlazadas; sin datos de mina copiados"
                            : "Linked references; no mine data copied"}
                        </td>
                        <td>
                          {es
                            ? "Métodos y límites de transporte"
                            : "Transport methods and scope"}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          {es ? "Proyecto importado" : "Imported project"}
                        </td>
                        <td>
                          {es
                            ? "Permanece local; licencia del usuario"
                            : "Remains local; user-supplied license"}
                        </td>
                        <td>
                          {es
                            ? "Análisis de nuevas entradas; fuera del benchmark público"
                            : "New-input analysis; outside public benchmark"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}
              {section.id === "regime-design" && (
                <table>
                  <thead>
                    <tr>
                      <th>{es ? "Régimen" : "Regime"}</th>
                      <th>{es ? "Definición exacta" : "Exact definition"}</th>
                      <th>{es ? "Efecto estudiado" : "Studied effect"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regimeDefinitions.map((r) => (
                      <tr key={r.id}>
                        <th scope="row">{tr(r.name, es)}</th>
                        <td>{tr(r.recipe, es)}</td>
                        <td>{tr(r.purpose, es)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </DeepSection>
          ),
        }))}
      />
    </div>
  );
}

// Every catalog row with its declared state: the Implementation page's "what is real in this build". The rows, states
// and reasons come from readiness.json; the page types none of them (ADR-0080). It sits in the page's own topic inside a
// region that scrolls on its own, so it adds no navigation row (ADR-0071).
import { useShellLang } from '@fasl-work/caos-app-shell';
import type { Readiness } from '../lib/contract.types';
import { NoteLine, PROVENANCE_LABEL, STATE_LABEL, WRAP } from './ReadinessNote';
import { viewState } from './readiness';
import { useReadiness } from './useReadiness';

type Lang = 'en' | 'es';

const HEAD: Record<Lang, string[]> = {
  en: ['Contract', 'Version', 'Catalog status', 'Provenance', 'State', 'Reason'],
  es: ['Contrato', 'Versión', 'Estado del catálogo', 'Procedencia', 'Estado', 'Razón'],
};
const CAPTION: Record<Lang, string> = {
  en: 'Every contract of the catalog with the state the readiness document declares for it',
  es: 'Cada contrato del catálogo con el estado que declara el documento de disponibilidad',
};
/** The reason column keeps a readable width; below it the region scrolls sideways instead of breaking the text letter by letter. */
const REASON_MIN = '16rem';
const LOADING: Record<Lang, string> = { en: 'Loading the readiness document', es: 'Cargando el documento de disponibilidad' };

/** The table for a given document: pure, so a test renders it for either language and for the three document states. */
export function ReadinessRows({ doc, lang }: { doc: Readiness | null | undefined; lang: Lang }) {
  if (doc === undefined) {
    return (
      <p className="caos-pending" data-state="loading">
        {LOADING[lang]}
      </p>
    );
  }
  if (doc === null) return <NoteLine view={viewState(null, [])} lang={lang} />;
  return (
    <div role="region" tabIndex={0} aria-label={CAPTION[lang]} style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table className="caos-table" data-state="ready">
        <caption>{CAPTION[lang]}</caption>
        <thead>
          <tr>
            {HEAD[lang].map((h, i) => (
              <th key={h} scope="col" className={i === 5 ? 'caos-col-text' : undefined} style={i === 5 ? { minWidth: REASON_MIN } : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doc.contracts.map((c) => (
            <tr key={c.id} data-readiness={c.state}>
              <td>{c.id}</td>
              <td>{c.version}</td>
              <td>{c.status}</td>
              <td>{c.provenance ? PROVENANCE_LABEL[c.provenance][lang] : '-'}</td>
              <td>{STATE_LABEL[c.state][lang]}</td>
              <td className="caos-col-text" style={{ ...WRAP, minWidth: REASON_MIN }}>
                {c.reason ? c.reason[lang] : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReadinessTable() {
  const lang = useShellLang();
  const doc = useReadiness();
  return <ReadinessRows doc={doc} lang={lang} />;
}

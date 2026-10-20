// The Implementation page's "what is real in this build": every catalog row the readiness document lists, with its
// state and reason in the displayed language, taken from the document and never typed in the page (ADR-0080; ADR-0071:
// a table inside the page's own topic, no new navigation row).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useLangStore } from '@fasl-work/caos-app-shell'
import { describe, expect, it } from 'vitest'
import type { Readiness } from '../lib/contract.types'
import { ImplementationTopic } from '../pages/Implementation'
import { ReadinessRows } from './ReadinessTable'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (rel: string): Readiness => JSON.parse(readFileSync(join(repo, rel), 'utf8'))
const committed = read('data/readiness.json')
const fixture = read('docs/contracts/fixtures/data/readiness.json')
const html = (doc: Readiness | null | undefined, lang: 'en' | 'es') =>
  renderToStaticMarkup(createElement(ReadinessRows, { doc, lang }))
const rows = (h: string) => [...h.matchAll(/<tr data-readiness="([a-z]+)"[^>]*><td>([^<]*)<\/td>/g)].map((m) => [m[2], m[1]])

describe('the readiness table of the Implementation page', () => {
  it.each(['en', 'es'] as const)('lists every row of the document, in its order, with its state (%s)', (lang) => {
    for (const doc of [committed, fixture]) {
      expect(rows(html(doc, lang))).toEqual(doc.contracts.map((c) => [c.id, c.state]))
    }
  })

  it.each(['en', 'es'] as const)('carries the document reasons in the displayed language (%s)', (lang) => {
    const h = html(fixture, lang)
    const withReason = fixture.contracts.filter((c) => c.reason)
    expect(withReason.length).toBeGreaterThan(0)
    for (const c of withReason) expect(h).toContain(c.reason![lang].replace(/&/g, '&amp;').replace(/'/g, '&#x27;'))
  })

  it('has the six columns, scrolls inside its own region and takes no navigation row', () => {
    const h = html(committed, 'en')
    expect((h.match(/<th /g) ?? []).length).toBe(6)
    expect(h).toContain('role="region"')
    expect(h).toContain('tabindex="0"')
    expect(h).not.toContain('role="tab"')
  })

  it('says loading while the document loads and unknown when it cannot be read, in both languages', () => {
    expect(html(undefined, 'en')).toContain('Loading the readiness document')
    expect(html(undefined, 'es')).toContain('Cargando el documento de disponibilidad')
    expect(html(null, 'en')).toContain('Readiness unknown')
    expect(html(null, 'es')).toContain('Disponibilidad desconocida')
  })
})

describe('the table on the Implementation page', () => {
  // Server rendering reads the shell's language store at its initial value (English), so the Spanish text of the table is
  // held by the ReadinessRows tests above, which take the language as a property.
  it('sits in the reproducibility topic only, inside its own section, adding no tab', () => {
    useLangStore.setState({ lang: 'en' })
    const shown = renderToStaticMarkup(createElement(ImplementationTopic, { id: 'reproducibility' }))
    expect(shown).toContain('id="content-reproduction-record"')
    expect(shown).toContain('What is real in this build')
    expect(shown).toContain('Loading the readiness document')
    expect(shown).not.toContain('role="tab"')
    for (const other of ['inputs', 'solvers', 'transport-engine', 'routing', 'cuda-ensemble', 'models', 'deployment']) {
      expect(renderToStaticMarkup(createElement(ImplementationTopic, { id: other }))).not.toContain('Loading the readiness document')
    }
  })
})

import type { Network, Options, Result } from './contracts'
import { LIMITS, solveNetwork, validateNetwork, validateOptions } from './engine'

export interface ProjectInputs {
  schema: 'aerovia.project/v1'
  network: Network
  options: Options
  baseline?: { network: Network; options: Options }
  savedAt: string
}
export interface Project extends Omit<ProjectInputs, 'baseline'> {
  baseline?: { network: Network; options: Options; result: Result }
}
type StorageReader = Pick<Storage, 'getItem'>
type StorageWriter = Pick<Storage, 'setItem'>
export const PROJECT_STORAGE_KEY = 'aerovia.project.v1'

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

/** Allowlist inputs only: no paths, author/account fields, device data or result arrays are copied. */
function validatedInputs(input: unknown): ProjectInputs {
  const data = object(input, 'Project')
  if (data.schema !== 'aerovia.project/v1') throw new Error('Unsupported project schema. Expected aerovia.project/v1.')
  const network = validateNetwork(data.network)
  const options = validateOptions(data.options, network)
  if (typeof data.savedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(data.savedAt)) throw new Error('Project savedAt must be an ISO UTC timestamp.')
  const date = new Date(data.savedAt)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== data.savedAt.slice(0, 19)) throw new Error('Project savedAt is not a valid calendar date.')
  let baseline: ProjectInputs['baseline']
  if (data.baseline !== undefined) {
    const source = object(data.baseline, 'Project baseline')
    const baselineNetwork = validateNetwork(source.network)
    baseline = { network: baselineNetwork, options: validateOptions(source.options, baselineNetwork) }
  }
  return { schema: 'aerovia.project/v1', network, options, ...(baseline ? { baseline } : {}), savedAt: date.toISOString() }
}

/**
 * Load untrusted project state. Baseline result arrays are never trusted, even if
 * they claim to be converged. Recompute the baseline from its scientific inputs.
 * Current interventions may be nonconvergent drafts and are preserved for repair.
 */
export function validateProject(input: unknown): Project {
  const inputs = validatedInputs(input)
  if (!inputs.baseline) return { schema: inputs.schema, network: inputs.network, options: inputs.options, savedAt: inputs.savedAt }
  const result = solveNetwork(inputs.baseline.network, inputs.baseline.options)
  if (!result.converged) throw new Error(`Saved baseline cannot be restored: ${result.message ?? 'the baseline equations do not converge'}`)
  return { ...inputs, baseline: { ...inputs.baseline, result } }
}

/** UTF-8 size is checked before parsing. Importing code must also check File.size before reading. */
export function parseProject(text: string): Project {
  if (new TextEncoder().encode(text).byteLength > LIMITS.fileBytes) throw new Error('Project exceeds the 2 MiB import limit.')
  let input: unknown
  try { input = JSON.parse(text) } catch { throw new Error('Project is not valid JSON.') }
  return validateProject(input)
}

/**
 * Reproducible export for scripts/pipeline.py --input: retain the original network
 * and every operating option, including closures and global multipliers. Persist
 * baseline inputs only; their result is reconstructed and verified during load.
 * No filesystem paths, browser/account metadata or inferred author data is added.
 */
export function serializeProject(project: ProjectInputs | Project, pretty = true): string {
  const text = JSON.stringify(validatedInputs(project), null, pretty ? 2 : undefined)
  if (new TextEncoder().encode(text).byteLength > LIMITS.fileBytes) throw new Error('Project exceeds the 2 MiB storage/export limit.')
  return text
}

export function readSaved(storage?: StorageReader): Project | null {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(PROJECT_STORAGE_KEY)
    return raw ? parseProject(raw) : null
  } catch {
    // Malformed or unavailable device storage cannot prevent a fresh workspace.
    return null
  }
}

/** Appearance preferences must never make the scientific workspace depend on storage access. */
export function readPreference(name: 'lang' | 'theme', storage?: StorageReader): string | null {
  try { return (storage ?? globalThis.localStorage).getItem(`aerovia.${name}`) } catch { return null }
}

export function persistProject(project: ProjectInputs | Project, storage?: StorageWriter): void {
  // Validate and serialize before touching storage, preserving the prior saved
  // workspace if current data are malformed. Quota/security errors reach the UI.
  const text = serializeProject(project, false)
  const destination = storage ?? globalThis.localStorage
  destination.setItem(PROJECT_STORAGE_KEY, text)
}

export function download(name: string, content: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '') || 'aerovia-export.json'
  link.hidden = true
  document.body.appendChild(link)
  try { link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000) }
}

/** RFC-style quoting plus spreadsheet-formula neutralization for text cells. */
export function csvCell(value: unknown): string {
  const text = String(value ?? '')
  const formula = /^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)
  const safe = typeof value !== 'number' && formula ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

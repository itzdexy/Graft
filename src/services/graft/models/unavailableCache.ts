import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getGraftHome } from '../../../../scripts/graft-home.js'
import { writeJsonAtomic } from '../../../../scripts/graft-safe-json.js'
import { readinessSource } from '../modelReadiness.js'

type Entry = { providerId: string; modelId: string; source: string; expiresAt: number }
const TTL = 6 * 60 * 60 * 1000
let entries: Entry[] | undefined
const path = () => join(getGraftHome(), '.graft', 'unavailable-models.json')

function load(): Entry[] {
  if (entries) return entries
  entries = []
  try {
    if (statSync(path()).size > 1_000_000) return entries
    const parsed: unknown = JSON.parse(readFileSync(path(), 'utf8'))
    if (!Array.isArray(parsed)) return entries
    entries = parsed.slice(0, 2000).filter((e): e is Entry => e &&
      typeof e.providerId === 'string' && e.providerId.length <= 128 &&
      typeof e.modelId === 'string' && e.modelId.length <= 512 &&
      /^[a-f0-9]{64}$/.test(e.source) && Number.isFinite(e.expiresAt) &&
      e.expiresAt > Date.now() && e.expiresAt <= Date.now() + TTL)
  } catch { /* A missing or malformed cache never blocks startup. */ }
  return entries
}

function save(): void {
  entries = load().filter(e => e.expiresAt > Date.now()).slice(-2000)
  try { mkdirSync(dirname(path()), {recursive:true}); writeJsonAtomic(path(), entries, {mode:0o600}) } catch { /* Best effort local evidence. */ }
}

/** Only call after a model-specific failure or another model confirmed this endpoint works. */
export function rememberUnavailableModel(providerId: string, modelId: string): void {
  entries = load().filter(e => e.providerId !== providerId || e.modelId !== modelId)
  entries.push({providerId,modelId,source:readinessSource(providerId),expiresAt:Date.now()+TTL})
  save()
}

export function rememberedUnavailableModel(providerId: string, modelId: string): boolean {
  const entry = load().find(e => e.providerId === providerId && e.modelId === modelId)
  return Boolean(entry && entry.expiresAt > Date.now() && entry.source === readinessSource(providerId))
}

export function forgetUnavailableModel(providerId: string, modelId: string): void {
  const before = load()
  entries = before.filter(e => e.providerId !== providerId || e.modelId !== modelId)
  if (entries.length !== before.length) save()
}

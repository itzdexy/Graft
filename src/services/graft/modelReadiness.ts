import { createHash } from 'node:crypto'
import { resolveProviderSelection } from '../../../scripts/graft-providers.js'
import type { ProviderErrorKind } from './providerErrors.js'

export function readinessSource(providerId: string): string {
  const selection = resolveProviderSelection(providerId, '__catalog__')
  return createHash('sha256').update(JSON.stringify(selection ? [selection.baseUrl, selection.apiKey, selection.authMode] : null)).digest('hex')
}

export type ModelReadinessState =
  | 'unknown'
  | 'listed'
  | 'probing'
  | 'ready'
  | 'chat_only'
  | 'slow'
  | 'unavailable'
  | 'unsuitable'

export type ModelReadinessRecord = {
  providerId: string
  modelId: string
  state: ModelReadinessState
  source: 'catalog' | 'provider' | 'registry' | 'probe'
  checkedAt: number
  latencyMs?: number
  supportsTools?: boolean
  supportsStreaming?: boolean
  detail?: string
  errorKind?: ProviderErrorKind
  hardFailure: boolean
}

type StoredReadiness = {
  source: string
  record: ModelReadinessRecord
  expiresAt: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000
const readiness = new Map<string, StoredReadiness>()

function readinessKey(providerId: string, modelId: string): string {
  return `${providerId}\0${modelId}`
}

export function setModelReadiness(
  record: ModelReadinessRecord,
  ttlMs = DEFAULT_TTL_MS,
): ModelReadinessRecord {
  readiness.set(readinessKey(record.providerId, record.modelId), {
    source: readinessSource(record.providerId),
    record: { ...record },
    expiresAt: record.checkedAt + ttlMs,
  })
  return record
}

export function getModelReadiness(
  providerId: string,
  modelId: string,
  now = Date.now(),
): ModelReadinessRecord | null {
  const key = readinessKey(providerId, modelId)
  const stored = readiness.get(key)
  if (!stored) return null
  if (now > stored.expiresAt || stored.source !== readinessSource(providerId)) {
    readiness.delete(key)
    return null
  }
  return { ...stored.record }
}

export function clearModelReadiness(
  providerId: string,
  modelId: string,
): void {
  readiness.delete(readinessKey(providerId, modelId))
}

export function resetModelReadiness(): void {
  readiness.clear()
}

export function listModelReadiness(
  providerId?: string,
  now = Date.now(),
): ModelReadinessRecord[] {
  const records: ModelReadinessRecord[] = []
  for (const [key, stored] of readiness) {
    if (now > stored.expiresAt || stored.source !== readinessSource(stored.record.providerId)) {
      readiness.delete(key)
      continue
    }
    if (!providerId || stored.record.providerId === providerId) {
      records.push({ ...stored.record })
    }
  }
  return records
}

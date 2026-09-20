import {
  clearModelReadiness,
  getModelReadiness,
  resetModelReadiness,
  setModelReadiness,
} from './modelReadiness.js'

const DEFAULT_FAILURE_TTL_MS = 30 * 60 * 1000

export function markProviderModelUnavailable(
  providerId: string,
  modelId: string,
  detail: string,
  ttlMs = DEFAULT_FAILURE_TTL_MS,
): void {
  setModelReadiness({
    providerId,
    modelId,
    state: 'unavailable',
    source: 'probe',
    checkedAt: Date.now(),
    detail,
    hardFailure: true,
  }, ttlMs)
}

export function clearProviderModelUnavailable(
  providerId: string,
  modelId: string,
): void {
  clearModelReadiness(providerId, modelId)
}

export function getProviderModelUnavailableReason(
  providerId: string,
  modelId: string,
): string | null {
  const record = getModelReadiness(providerId, modelId)
  return record?.state === 'unavailable' ? record.detail ?? 'Unavailable' : null
}

export function resetProviderModelAvailability(): void {
  resetModelReadiness()
}

import { resolveActive } from '../../../../scripts/tovyr-providers.js'
import type { ProviderConnectionSnapshot } from './types.js'

type Listener = () => void

const listeners = new Set<Listener>()

function initialSnapshot(): ProviderConnectionSnapshot {
  const active = resolveActive()
  if (!active) {
    return {
      state: 'unconfigured',
      providerId: '',
      providerLabel: '',
      modelId: '',
    }
  }
  return {
    state: 'checking',
    providerId: active.providerId,
    providerLabel: active.label,
    modelId: active.model,
  }
}

let snapshot = initialSnapshot()

export function getProviderConnectionSnapshot(): ProviderConnectionSnapshot {
  return snapshot
}

export function setProviderConnectionSnapshot(
  next: ProviderConnectionSnapshot,
): void {
  const unchanged =
    snapshot.state === next.state &&
    snapshot.providerId === next.providerId &&
    snapshot.modelId === next.modelId &&
    snapshot.checkedAt === next.checkedAt &&
    snapshot.detail === next.detail
  if (unchanged) return
  snapshot = next
  for (const listener of listeners) listener()
}

export function subscribeProviderConnection(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetProviderConnectionSnapshot(): void {
  snapshot = initialSnapshot()
  for (const listener of listeners) listener()
}


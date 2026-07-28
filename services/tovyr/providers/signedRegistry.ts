import { verify } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getTovyrConfigHomeDir } from '../../../utils/envUtils.js'
import type { ModelDescriptor } from './types.js'

export type ProviderRegistryPayload = {
  schemaVersion: 1
  publishedAt: string
  expiresAt: string
  providers: Record<string, ModelDescriptor[]>
}

export type SignedProviderRegistry = {
  payload: ProviderRegistryPayload
  signature: string
  keyId: string
}

export const DEFAULT_PROVIDER_REGISTRY_URL =
  'https://github.com/itsdexy/Tovyr/releases/latest/download/provider-registry.json'

function canonicalPayload(payload: ProviderRegistryPayload): string {
  return JSON.stringify(payload)
}

export function verifySignedProviderRegistry(
  envelope: SignedProviderRegistry,
  publicKeyPem: string,
  now = Date.now(),
): ProviderRegistryPayload | null {
  if (
    envelope?.payload?.schemaVersion !== 1 ||
    typeof envelope.signature !== 'string' ||
    typeof publicKeyPem !== 'string' ||
    !publicKeyPem.trim()
  ) {
    return null
  }
  const published = Date.parse(envelope.payload.publishedAt)
  const expires = Date.parse(envelope.payload.expiresAt)
  if (
    !Number.isFinite(published) ||
    !Number.isFinite(expires) ||
    published > now + 24 * 60 * 60 * 1000 ||
    expires <= now
  ) {
    return null
  }
  try {
    const valid = verify(
      null,
      Buffer.from(canonicalPayload(envelope.payload)),
      publicKeyPem,
      Buffer.from(envelope.signature, 'base64'),
    )
    return valid ? envelope.payload : null
  } catch {
    return null
  }
}

function registryPath(): string {
  return join(getTovyrConfigHomeDir(), 'cache', 'provider-registry.json')
}

function configuredPublicKey(): string {
  return process.env.TOVYR_PROVIDER_REGISTRY_PUBLIC_KEY?.replace(/\\n/g, '\n') || ''
}

export function readLastKnownGoodProviderRegistry(): ProviderRegistryPayload | null {
  const publicKey = configuredPublicKey()
  if (!publicKey) return null
  try {
    const envelope = JSON.parse(
      readFileSync(registryPath(), 'utf8'),
    ) as SignedProviderRegistry
    return verifySignedProviderRegistry(envelope, publicKey)
  } catch {
    return null
  }
}

function writeRegistryAtomic(envelope: SignedProviderRegistry): void {
  const path = registryPath()
  mkdirSync(join(getTovyrConfigHomeDir(), 'cache'), { recursive: true })
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  renameSync(temporary, path)
}

export async function refreshSignedProviderRegistry(
  options: { url?: string; signal?: AbortSignal } = {},
): Promise<ProviderRegistryPayload | null> {
  const publicKey = configuredPublicKey()
  if (!publicKey) return readLastKnownGoodProviderRegistry()
  const url =
    options.url ||
    process.env.TOVYR_PROVIDER_REGISTRY_URL ||
    DEFAULT_PROVIDER_REGISTRY_URL
  try {
    const response = await fetch(url, {
      signal: options.signal || AbortSignal.timeout(5_000),
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return readLastKnownGoodProviderRegistry()
    const envelope = (await response.json()) as SignedProviderRegistry
    const payload = verifySignedProviderRegistry(envelope, publicKey)
    if (!payload) return readLastKnownGoodProviderRegistry()
    writeRegistryAtomic(envelope)
    return payload
  } catch {
    return readLastKnownGoodProviderRegistry()
  }
}

export function registryModelsForProvider(
  payload: ProviderRegistryPayload | null,
  providerId: string,
): ModelDescriptor[] {
  if (!payload) return []
  const models = payload.providers[providerId]
  if (!Array.isArray(models)) return []
  return models
    .filter(model => model && typeof model.id === 'string' && model.available)
    .map(model => ({ ...model, source: 'signed-registry' as const }))
}

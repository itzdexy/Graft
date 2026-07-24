import { isCatalogModel } from '../../scripts/blink-provider-catalog.js'
import { providerNeedsOpenAiCompat } from '../../scripts/blink-provider-upstream.js'
import {
  getDefaultModelId,
  getProvider,
} from '../../scripts/blink-providers.js'
import { isModelProviderMismatch } from './providerFailover.js'
import { pickBestProviderModel } from './providerModelPick.js'
import {
  fetchActiveProviderModelIds,
  getCachedProviderModelIds,
} from './providerModels.js'

export type ModelValidationResult =
  | { ok: true; model: string; corrected: boolean; notice?: string }
  | { ok: false; message: string; suggestion?: string }

/** Lowercase trim for loose id comparison across vendor prefixes. */
export function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase()
}

/** Map a requested id to the canonical id returned by GET /v1/models. */
export function resolveModelInVerifiedList(
  modelId: string,
  verified: string[],
): string | null {
  if (!modelId || verified.length === 0) return null
  if (verified.includes(modelId)) return modelId

  const norm = normalizeModelId(modelId)
  for (const id of verified) {
    if (normalizeModelId(id) === norm) return id
  }

  const modelSlug = modelId.includes('/') ? modelId.split('/').pop()! : modelId
  const modelSlugNorm = modelSlug.toLowerCase()
  for (const id of verified) {
    const slug = id.includes('/') ? id.split('/').pop()! : id
    if (slug.toLowerCase() === modelSlugNorm) return id
  }

  return null
}

export function isModelVerifiedForProvider(
  modelId: string,
  verified: string[],
): boolean {
  return resolveModelInVerifiedList(modelId, verified) !== null
}

/**
 * Pick the best model for a provider: keep verified matches, otherwise catalog
 * default or best verified alternative.
 */
export function reconcileModelWithVerified(
  providerId: string,
  modelId: string,
  verified: string[],
): { model: string; corrected: boolean } {
  const def = getProvider(providerId)
  const fallback =
    pickBestProviderModel(providerId, verified) ||
    getDefaultModelId(def) ||
    modelId

  if (!verified.length) {
    return { model: modelId, corrected: false }
  }

  const resolved = resolveModelInVerifiedList(modelId, verified)
  if (resolved) {
    return { model: resolved, corrected: resolved !== modelId }
  }

  return { model: fallback, corrected: fallback !== modelId }
}

/**
 * Validate (and optionally normalize) a model id for a provider.
 * OpenAI-compat providers require a warm GET /v1/models list when possible.
 */
export async function validateModelForProvider(
  providerId: string,
  modelId: string,
  options: { forceFetch?: boolean } = {},
): Promise<ModelValidationResult> {
  const def = getProvider(providerId)
  if (!def) {
    return { ok: false, message: `Unknown provider: ${providerId}` }
  }

  const trimmed = modelId?.trim()
  if (!trimmed) {
    return { ok: false, message: 'Model id is required.' }
  }

  if (isModelProviderMismatch(trimmed, providerId)) {
    const suggestion = getDefaultModelId(def) || undefined
    return {
      ok: false,
      message: `Model "${trimmed}" is not valid for ${def.label}.`,
      suggestion,
    }
  }

  if (!isCatalogModel(def, trimmed)) {
    const valid = (def.models || []).map(m => m.id)
    const hint = valid.length
      ? ` Valid models: ${valid.slice(0, 6).join(', ')}${valid.length > 6 ? ', …' : ''}.`
      : ''
    return {
      ok: false,
      message: `Model "${trimmed}" is not supported by ${def.label}.${hint} Run /model to choose one.`,
    }
  }

  if (!providerNeedsOpenAiCompat(def)) {
    return { ok: true, model: trimmed, corrected: false }
  }

  let verified =
    options.forceFetch === true
      ? await fetchActiveProviderModelIds({ force: true })
      : getCachedProviderModelIds()

  if (!verified?.length) {
    verified = await fetchActiveProviderModelIds({
      force: options.forceFetch === true,
    })
  }

  if (!verified?.length) {
    const inStaticCatalog = def.models?.some(m => m.id === trimmed)
    if (inStaticCatalog) {
      return { ok: true, model: trimmed, corrected: false }
    }
    const suggestion = getDefaultModelId(def) || undefined
    return {
      ok: false,
      message: `Could not verify "${trimmed}" for ${def.label} (model list unavailable). Check your API key and run /model.`,
      suggestion,
    }
  }

  const resolved = resolveModelInVerifiedList(trimmed, verified)
  if (resolved) {
    return {
      ok: true,
      model: resolved,
      corrected: resolved !== trimmed,
      notice:
        resolved !== trimmed
          ? `Normalized to verified id ${resolved}.`
          : undefined,
    }
  }

  const suggestion =
    pickBestVerifiedModel(providerId, verified, new Set([trimmed])) ||
    getDefaultModelId(def) ||
    undefined

  return {
    ok: false,
    message: `Model "${trimmed}" is not available on ${def.label}.`,
    suggestion,
  }
}

import { isCatalogModel } from '../../../scripts/graft-provider-catalog.js'
import { providerNeedsOpenAiCompat } from '../../../scripts/graft-provider-upstream.js'
import {
  getDefaultModelId,
  getProvider,
} from '../../../scripts/graft-providers.js'
import { isModelProviderMismatch } from './providerFailover.js'
import {
  pickBestProviderModel,
  pickBestVerifiedModel,
} from './providerModelPick.js'
import {
  fetchProviderModelIds,
  getCachedProviderModelIdsFor,
} from './providerModels.js'
import { isMetaAgentModelId, isMetaProviderId } from './metaProvider.js'

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
  const slugMatches = verified.filter(id => {
    const slug = id.includes('/') ? id.split('/').pop()! : id
    return slug.toLowerCase() === modelSlugNorm
  })
  return slugMatches.length === 1 ? slugMatches[0]! : null
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

  if (isMetaProviderId(providerId) && !isMetaAgentModelId(trimmed)) {
    const suggestion = getDefaultModelId(def) || 'muse-spark-1.3'
    return {
      ok: false,
      message: `Model "${trimmed}" is not a Muse Spark coding model on ${def.label}.`,
      suggestion,
    }
  }

  // Provider-owned inventory is stronger evidence than vendor-name heuristics.
  // Always load the requested provider, even when another provider is active.
  let verified = getCachedProviderModelIdsFor(providerId)
  if (options.forceFetch || (!verified && providerNeedsOpenAiCompat(def))) {
    verified = await fetchProviderModelIds(providerId, { force: options.forceFetch === true })
  }
  const listed = verified?.length ? resolveModelInVerifiedList(trimmed, verified) : null
  if (listed) return { ok: true, model: listed, corrected: listed !== trimmed }

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

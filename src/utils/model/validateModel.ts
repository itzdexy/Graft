// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { MODEL_ALIASES } from './aliases.js'
import { isModelAllowed } from './modelAllowlist.js'
import { getAPIProvider } from './providers.js'
import { isGraftRuntime } from '../graftRuntime.js'
// @ts-ignore: plain JS provider module has no type declarations
import { getDefaultModelId, getProvider, isCatalogModel, resolveActive } from '../../../scripts/graft-providers.js'
import { validateModelForProvider } from '../../services/graft/validateProviderModel.js'
import { sideQuery } from '../sideQuery.js'
import {
  NotFoundError,
  APIError,
  APIConnectionError,
  AuthenticationError,
} from '@anthropic-ai/sdk'
import { getModelStrings } from './modelStrings.js'

// Cache valid models to avoid repeated API calls
const validModelCache = new Map<string, boolean>()

/**
 * Validates a model by attempting an actual API call.
 */
export async function validateModel(
  model: string,
): Promise<{ valid: boolean; error?: string }> {
  const normalizedModel = model.trim()

  // Empty model is invalid
  if (!normalizedModel) {
    return { valid: false, error: 'Model name cannot be empty' }
  }

  // Check against availableModels allowlist before any API call
  if (!isModelAllowed(normalizedModel)) {
    return {
      valid: false,
      error: `Model '${normalizedModel}' is not in the list of available models`,
    }
  }

  // Check if it's a known alias (these are always valid outside Graft; inside
  // Graft we resolve them against the active provider's catalog below).
  const lowerModel = normalizedModel.toLowerCase()
  if (!isGraftRuntime() && (MODEL_ALIASES as readonly string[]).includes(lowerModel)) {
    return { valid: true }
  }

  // Check if it matches ANTHROPIC_CUSTOM_MODEL_OPTION (pre-validated by the user)
  if (normalizedModel === process.env.ANTHROPIC_CUSTOM_MODEL_OPTION) {
    return { valid: true }
  }

  // For Graft, use the provider-aware validator (catalog + live /v1/models).
  // This avoids a slow sideQuery/API call when the model is unsupported or
  // when the provider is an OpenAI-compatible gateway.
  if (isGraftRuntime()) {
    const active = resolveActive()
    if (active?.providerId) {
      const provider = getProvider(active.providerId)
      if (provider) {
        const resolvedModel = resolveAliasToProviderModel(normalizedModel, provider)
        const validation = await validateModelForProvider(
          active.providerId,
          resolvedModel,
        )
        if (validation.ok) {
          validModelCache.set(normalizedModel, true)
          if (validation.model && validation.model !== normalizedModel) {
            validModelCache.set(validation.model, true)
          }
          return { valid: true }
        }
        return {
          valid: false,
          error:
            validation.message +
            (validation.suggestion ? ` Try '${validation.suggestion}'.` : ''),
        }
      }
    }
  }

  // Check cache first
  if (validModelCache.has(normalizedModel)) {
    return { valid: true }
  }


  // Try to make an actual API call with minimal parameters
  try {
    await sideQuery({
      model: normalizedModel,
      max_tokens: 1,
      maxRetries: 0,
      querySource: 'model_validation',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hi',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ],
    })

    // If we got here, the model is valid
    validModelCache.set(normalizedModel, true)
    return { valid: true }
  } catch (error) {
    return handleValidationError(error, normalizedModel)
  }
}

function handleValidationError(
  error: unknown,
  modelName: string,
): { valid: boolean; error: string } {
  // NotFoundError (404) means the model doesn't exist
  if (error instanceof NotFoundError) {
    const fallback = get3PFallbackSuggestion(modelName)
    const suggestion = fallback ? `. Try '${fallback}' instead` : ''
    return {
      valid: false,
      error: `Model '${modelName}' not found${suggestion}`,
    }
  }

  // For other API errors, provide context-specific messages
  if (error instanceof APIError) {
    if (error instanceof AuthenticationError) {
      return {
        valid: false,
        error: 'Authentication failed. Please check your API credentials.',
      }
    }

    if (error instanceof APIConnectionError) {
      return {
        valid: false,
        error: 'Network error. Please check your internet connection.',
      }
    }

    // Check error body for model-specific errors
    const errorBody = error.error as unknown
    if (
      errorBody &&
      typeof errorBody === 'object' &&
      'type' in errorBody &&
      errorBody.type === 'not_found_error' &&
      'message' in errorBody &&
      typeof errorBody.message === 'string' &&
      errorBody.message.includes('model:')
    ) {
      return { valid: false, error: `Model '${modelName}' not found` }
    }

    // Generic API error
    return { valid: false, error: `API error: ${error.message}` }
  }

  // For unknown errors, be safe and reject
  const errorMessage = error instanceof Error ? error.message : String(error)
  return {
    valid: false,
    error: `Unable to validate model: ${errorMessage}`,
  }
}

// @[MODEL LAUNCH]: Add a fallback suggestion chain for the new model → previous version
function resolveAliasToProviderModel(modelId: string, provider: any): string {
  const base = modelId.toLowerCase().replace(/\[1m\]$/i, '')
  const tier =
    base === 'opus'
      ? 'opus'
      : base === 'sonnet'
        ? 'sonnet'
        : base === 'haiku'
          ? 'haiku'
          : null
  if (!tier) return modelId

  const models = provider.models || []
  const candidates = models.filter((m: any) => m.tier === tier)
  if (!candidates.length) return modelId

  const defaultModel = provider.defaultModel
  const defEntry = defaultModel ? models.find((m: any) => m.id === defaultModel) : null
  if (defEntry?.tier === tier) return defEntry.id
  return candidates[0].id
}

/**
 * Suggest a fallback model for 3P users when the selected model is unavailable.
 */
function get3PFallbackSuggestion(model: string): string | undefined {
  if (getAPIProvider() === 'firstParty') {
    return undefined
  }
  const lowerModel = model.toLowerCase()
  if (lowerModel.includes('opus-4-6') || lowerModel.includes('opus_4_6')) {
    return getModelStrings().opus41
  }
  if (lowerModel.includes('sonnet-4-6') || lowerModel.includes('sonnet_4_6')) {
    return getModelStrings().sonnet45
  }
  if (lowerModel.includes('sonnet-4-5') || lowerModel.includes('sonnet_4_5')) {
    return getModelStrings().sonnet40
  }
  return undefined
}

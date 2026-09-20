/**
 * Local/self-hosted providers that do not require a cloud API key.
 */

const LOCAL_PROVIDER_IDS = new Set(['ollama', 'lmstudio'])

/** @param {{ id?: string, category?: string, apiFormat?: string }|null|undefined} provider */
export function isLocalProvider(provider) {
  if (!provider?.id) return false
  return LOCAL_PROVIDER_IDS.has(provider.id)
}

/** Placeholder upstream key for OpenAI-compat local servers that ignore auth. */
export const LOCAL_PROVIDER_PLACEHOLDER_KEY = 'local-only'

/** @param {string} providerId */
export function isLocalProviderId(providerId) {
  return LOCAL_PROVIDER_IDS.has(providerId)
}

export { LOCAL_PROVIDER_IDS }

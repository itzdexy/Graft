/**
 * Providers whose baseUrl speaks OpenAI Chat Completions, not Anthropic /v1/messages.
 * Graft starts a local translation proxy for these.
 */

/** @param {{ id?: string, apiFormat?: string, baseUrl?: string }|null|undefined} provider */
export function providerNeedsOpenAiCompat(provider) {
  if (!provider) return false
  if (provider.apiFormat === 'openai') return true
  if (provider.id === 'nvidia_nim') return true
  const url = (provider.baseUrl || '').toLowerCase()
  return (
    url.includes('integrate.api.nvidia.com') ||
    url.includes('/v1/openai')
  )
}

/** @param {string} baseUrl */
export function openAiChatCompletionsUrl(baseUrl) {
  const base = (baseUrl || '').replace(/\/+$/, '')
  if (base.endsWith('/chat/completions')) return base
  return `${base}/chat/completions`
}

/** @param {string} baseUrl */
export function openAiModelsUrl(baseUrl) {
  const base = (baseUrl || '').replace(/\/+$/, '')
  if (base.endsWith('/models')) return base
  return `${base}/models`
}

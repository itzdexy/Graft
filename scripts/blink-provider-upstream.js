/**
 * Providers whose baseUrl speaks OpenAI Chat Completions, not Blink /v1/messages.
 * Blink starts a local translation proxy for these.
 */

/** @param {{ id?: string, apiFormat?: string, baseUrl?: string }|null|undefined} provider */
export function providerNeedsOpenAiCompat(provider) {
  if (!provider) return false
  if (provider.apiFormat === 'openai') return true
  if (provider.id === 'nvidia_nim' || provider.id === 'ollama' || provider.id === 'lmstudio') {
    return true
  }
  const url = (provider.baseUrl || '').toLowerCase()
  return (
    url.includes('integrate.api.nvidia.com') ||
    url.includes('/v1/openai') ||
    url.includes('127.0.0.1:11434') ||
    url.includes('localhost:11434') ||
    url.includes('127.0.0.1:1234') ||
    url.includes('localhost:1234')
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

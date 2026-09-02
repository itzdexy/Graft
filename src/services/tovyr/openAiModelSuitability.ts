/**
 * Suitability filters for OpenAI-compat /v1/models lists (NIM, OpenRouter, etc.).
 * Providers often list embeds, guards, and code-completion models that hang or
 * 404 on chat — never auto-pick or show those for the agent.
 */

const UNSUITABLE_RE =
  /(codellama|code[\s._-]?llama|embed|rerank|guard|whisper|\btts\b|text-embedding|moderation|\bclip\b|nvclip|diffusion|\bimage\b|\baudio\b|\bspeech\b|\basr\b|\bstt\b|nemoretriever|safety|content-safety|ocr|transcri)/i

/** Models that are listed by the API but are poor/invalid agent chat targets. */
export function isAgentSuitableOpenAiModel(modelId: string): boolean {
  const id = modelId.trim()
  if (!id) return false
  if (UNSUITABLE_RE.test(id)) return false
  return true
}

/**
 * OpenAI-compat models that default to long chain-of-thought unless we send
 * `chat_template_kwargs.enable_thinking: false` (NIM GLM, DeepSeek-R1, …).
 */
export function modelUsesOpenAiThinkingKwargs(modelId: string): boolean {
  const id = modelId.toLowerCase()
  return (
    /\b(glm|deepseek-r1|reasoner|qwq|nemotron-3-nano)\b/.test(id) ||
    id.startsWith('z-ai/')
  )
}

/** Prefer instruct/chat-tuned ids when ranking fallback API remainder. */
export function openAiModelChatPreferenceScore(modelId: string): number {
  const s = modelId.toLowerCase()
  let score = 0
  if (/\binstruct\b/.test(s)) score += 3
  if (/\bchat\b/.test(s)) score += 2
  if (/\b(nemotron|llama-3\.|qwen|mistral|gemma|phi)\b/.test(s)) score += 1
  if (/\b(base|completion)\b/.test(s)) score -= 2
  // Huge reasoning models are fine for agents but a poor default for snappy chat.
  if (/\b(r1|reasoner|glm-5)\b/.test(s)) score -= 1
  return score
}

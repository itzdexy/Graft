const CLAUDE_MODEL_ID = /(?:^|[\/:@._-])claude(?:[\/:@._-]|$)/i
const CLAUDE_FAMILY_LABEL = /^(?:(?:Tovyr|Claude)\s+)?((?:(?:\d+(?:\.\d+)?)\s+)?(?:Opus|Sonnet|Haiku|Fable|Mythos)\b.*)$/i

/**
 * Keep provider-owned model families intact at the presentation boundary.
 * This function changes visible labels only; callers retain the wire model id.
 *
 * @param {{providerId?: string | null, modelId: string, label?: string | null}} input
 * @returns {string}
 */
export function formatProviderModelDisplayName(input) {
  const modelId = typeof input?.modelId === 'string' ? input.modelId : ''
  const label = typeof input?.label === 'string' ? input.label.trim() : ''
  const raw = label || modelId
  const providerId = String(input?.providerId || '').toLowerCase()
  const isClaude = providerId === 'anthropic' || CLAUDE_MODEL_ID.test(modelId)

  if (!isClaude || !raw) return raw
  if (/^Claude\b/i.test(raw)) return raw.replace(/^claude\b/i, 'Claude')

  const family = raw.match(CLAUDE_FAMILY_LABEL)
  if (family) return `Claude ${family[1]}`

  return raw.replace(/^Tovyr\b/i, 'Claude')
}

const UNKNOWN_SKILL_PREFIX = 'Unknown skill:'

/** Small-talk turns should never expose Skill to weaker tool-calling models. */
export function isCasualConversationPrompt(value: string | null): boolean {
  if (!value) return false
  return /^(?:hi|hello|hey|hiya|howdy|good\s+(?:morning|afternoon|evening)|how\s+are\s+you|what(?:'s| is)\s+up)[!?.\s]*$/i.test(
    value.trim(),
  )
}

/**
 * Questions whose answers change with wall-clock time need live grounding.
 * This intentionally avoids broad matches such as "time complexity".
 */
export function requiresLiveWebTool(value: string | null): boolean {
  if (!value) return false
  const prompt = value.trim()
  return (
    /\b(?:weather|forecast)\b/i.test(prompt) ||
    /\b(?:latest|breaking|today'?s|current)\s+news\b/i.test(prompt) ||
    /\b(?:current|live)\b.{0,40}\b(?:price|exchange\s+rate|score)\b/i.test(
      prompt,
    )
  )
}

/** Clock/date questions are machine-local facts, not web-search tasks. */
export function isLocalClockPrompt(value: string | null): boolean {
  if (!value) return false
  const prompt = value.trim()
  return (
    /^(?:what(?:'s| is)\s+)?(?:the\s+)?(?:current|local)\s+time\b/i.test(
      prompt,
    ) ||
    /^(?:what\s+time\s+is\s+it|tell\s+me\s+the\s+time)\b/i.test(prompt) ||
    /^(?:what(?:'s| is)\s+)?(?:today'?s|the\s+current)\s+date\b/i.test(
      prompt,
    )
  )
}

export function isRecoverableUnknownSkillResult(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trimStart().startsWith(UNKNOWN_SKILL_PREFIX)
  }
  if (Array.isArray(value)) {
    return value.some(item => {
      if (!item || typeof item !== 'object') return false
      const text = (item as { text?: unknown }).text
      return (
        typeof text === 'string' &&
        text.trimStart().startsWith(UNKNOWN_SKILL_PREFIX)
      )
    })
  }
  return false
}

export function formatUnknownSkillCorrection(
  requested: string,
  availableNames: string[],
): string {
  const names = availableNames
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 40)
  const available =
    names.length > 0 ? ` Available skills: ${names.join(', ')}.` : ''
  return (
    `${UNKNOWN_SKILL_PREFIX} ${requested}.` +
    ' This is a recoverable model tool-call mistake.' +
    ' Do not retry an invented skill. Answer the user directly unless one of the exact listed skill names clearly applies.' +
    available
  )
}

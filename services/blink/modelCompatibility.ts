const UNKNOWN_SKILL_PREFIX = 'Unknown skill:'

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

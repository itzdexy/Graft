/**
 * Theory-of-Mind module (OpenHands pattern).
 * Tracks inferred user goals, knowledge, and emotional tone for better responses.
 */

export interface UserModel {
  sessionId: string
  inferredGoals: string[]
  assumedSkillLevel: 'beginner' | 'intermediate' | 'expert'
  preferredVerbosity: 'terse' | 'balanced' | 'detailed'
  frustrations: string[]
  lastUpdated: number
}

const models = new Map<string, UserModel>()

function defaultModel(sessionId: string): UserModel {
  return {
    sessionId,
    inferredGoals: [],
    assumedSkillLevel: 'intermediate',
    preferredVerbosity: 'balanced',
    frustrations: [],
    lastUpdated: Date.now(),
  }
}

export function getUserModel(sessionId: string): UserModel {
  let m = models.get(sessionId)
  if (!m) {
    m = defaultModel(sessionId)
    models.set(sessionId, m)
  }
  return m
}

export function updateUserModelFromPrompt(
  sessionId: string,
  prompt: string,
): UserModel {
  const m = getUserModel(sessionId)
  const lower = prompt.toLowerCase()

  if (/\b(quick|fast|brief|tl;dr|short)\b/.test(lower)) {
    m.preferredVerbosity = 'terse'
  } else if (/\b(explain|detail|walk me through|why)\b/.test(lower)) {
    m.preferredVerbosity = 'detailed'
  }

  if (/\b(new to|beginner|don't know|never used)\b/.test(lower)) {
    m.assumedSkillLevel = 'beginner'
  } else if (/\b(architect|senior|production|scale)\b/.test(lower)) {
    m.assumedSkillLevel = 'expert'
  }

  if (/\b(frustrated|broken|still not|doesn't work|wtf)\b/.test(lower)) {
    m.frustrations.push(prompt.slice(0, 120))
    if (m.frustrations.length > 5) m.frustrations.shift()
  }

  const goalMatch = prompt.match(
    /(?:i want to|need to|help me|implement|fix|build)\s+(.{10,80})/i,
  )
  if (goalMatch) {
    const goal = goalMatch[1]!.trim()
    if (!m.inferredGoals.includes(goal)) {
      m.inferredGoals.push(goal)
      if (m.inferredGoals.length > 8) m.inferredGoals.shift()
    }
  }

  m.lastUpdated = Date.now()
  return m
}

export function formatTheoryOfMindSection(m: UserModel): string {
  if (
    !m.inferredGoals.length &&
    m.assumedSkillLevel === 'intermediate' &&
    m.preferredVerbosity === 'balanced' &&
    !m.frustrations.length
  ) {
    return ''
  }
  const lines = ['# User model (theory of mind)', '']
  if (m.inferredGoals.length) {
    lines.push('Inferred goals:', ...m.inferredGoals.map(g => `- ${g}`), '')
  }
  lines.push(
    `Skill level: ${m.assumedSkillLevel}`,
    `Preferred verbosity: ${m.preferredVerbosity}`,
  )
  if (m.frustrations.length) {
    lines.push('', 'Recent frustration signals — be direct and verify fixes.')
  }
  return lines.join('\n')
}

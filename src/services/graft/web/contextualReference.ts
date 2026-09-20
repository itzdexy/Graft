const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi
const PLACEHOLDER_HOSTS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'www.example.com',
])

function messageText(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const root = message as {
    content?: unknown
    message?: { content?: unknown }
  }
  const content = root.message?.content ?? root.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .flatMap(block => {
      if (!block || typeof block !== 'object') return []
      const value = block as { text?: unknown; content?: unknown }
      if (typeof value.text === 'string') return [value.text]
      if (typeof value.content === 'string') return [value.content]
      return []
    })
    .join('\n')
}

function cleanUrl(value: string): string {
  return value.replace(/[.,;:!?]+$/, '')
}

function promptTerms(prompt: string): string[] {
  return [
    ...new Set(
      prompt
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9._-]{3,}/g)
        ?.filter(
          term =>
            ![
              'about',
              'explain',
              'please',
              'what',
              'this',
              'that',
              'with',
              'from',
            ].includes(term),
        ) ?? [],
    ),
  ]
}

/** Find the recent URL that a short follow-up is referring to. */
export function findContextualWebUrl(
  messages: unknown[],
  latestPrompt: string,
): string | null {
  const terms = promptTerms(latestPrompt)
  const candidates: string[] = []
  for (let index = messages.length - 1; index >= 0; index--) {
    const matches = messageText(messages[index]).match(URL_PATTERN) ?? []
    for (const match of matches) {
      const url = cleanUrl(match)
      if (!candidates.includes(url)) candidates.push(url)
    }
    if (candidates.length >= 20) break
  }
  if (candidates.length === 0) return null

  let best: { url: string; score: number } | null = null
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]!
    const haystack = candidate.toLowerCase()
    const termScore = terms.reduce(
      (score, term) => score + (haystack.includes(term) ? 4 : 0),
      0,
    )
    const score = termScore - index * 0.05
    if (!best || score > best.score) best = { url: candidate, score }
  }
  if (best && best.score > 0) return best.url
  if (/\b(?:it|this|that|page|site|repo|repository)\b/i.test(latestPrompt)) {
    return candidates[0] ?? null
  }
  return null
}

export function isPlaceholderWebTarget(value: string): boolean {
  try {
    return PLACEHOLDER_HOSTS.has(new URL(value).hostname.toLowerCase())
  } catch {
    return false
  }
}

/** Repair placeholder or non-URL read targets using recent conversation. */
export function resolveContextualWebTarget(
  target: string,
  messages: unknown[],
  latestPrompt: string,
): string {
  const trimmed = target.trim()
  const validUrl = /^https?:\/\//i.test(trimmed)
  if (validUrl && !isPlaceholderWebTarget(trimmed)) return trimmed
  return findContextualWebUrl(messages, latestPrompt) ?? trimmed
}

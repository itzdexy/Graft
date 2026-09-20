/** Natural-language phrases that mean the user wants files created or changed on disk. */
export const BUILD_INTENT_RE =
  /\b(code me|code a|code an|make me|make a|make an|build me|write me|give me|i need (?:a|an|the)?|i want (?:a|an|the)?|can you (?:make|create|build|write)|implement|scaffold|add feature|write a|write an|build a|build an|create a|create an|create the|dashboard|landing\s*page|web\s*page|webpage|html\s*page|basic\s*html|rust\s+web|web\s+server)\b/i

/**
 * Short follow-ups that carry a previous build request forward rather than
 * starting a new one: "do it", "build it now", "yes", "continue", "r".
 *
 * Without this the implementation guard engages on "build me a website" and
 * then disengages on every follow-up — which is precisely when a weak model
 * has started flailing and most needs to be held to producing files.
 */
const BUILD_CONTINUATION_RE =
  /^(?:do\s+it|do\s+that|build\s+it(?:\s+now)?|make\s+it|write\s+it|finish(?:\s+it)?|go\s+ahead|go(?:\s+on)?|continue|proceed|keep\s+going|resume|retry|try\s+again|again|now|yes|yeah|yep|yup|ok(?:ay)?|sure|please|r|y)\W*$/i

export function isBuildContinuation(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith('/')) return false
  return BUILD_CONTINUATION_RE.test(trimmed)
}

export function isImplementationRequest(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith('/')) return false
  if (BUILD_INTENT_RE.test(trimmed)) return true
  // "make a dashboard" / "build dashboard.html" without "me"
  if (
    /\b(make|build|create|write|generate)\b/i.test(trimmed) &&
    /\b(html|dashboard|landing|webpage|website|\.html|rust|web\s*server|api\s*server)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }
  if (/\bbuild\s+a\s+rust\b/i.test(trimmed)) return true
  if (
    /\b(showcase|portfolio|agent\s+page|agents?\s+showcase)\b/i.test(trimmed) &&
    /\b(page|website|site|web)\b/i.test(trimmed)
  ) {
    return true
  }
  if (
    /\b(docs?\s*(site|website)|documentation\s*(site|website)|full\s+docs|graft\s+docs)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }
  return false
}

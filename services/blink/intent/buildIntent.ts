/** Natural-language phrases that mean the user wants files created or changed on disk. */
export const BUILD_INTENT_RE =
  /\b(code me|code a|code an|make me|make a|make an|build me|write me|give me|i need (?:a|an|the)?|i want (?:a|an|the)?|can you (?:make|create|build|write)|implement|scaffold|add feature|write a|write an|build a|build an|create a|create an|create the|dashboard|landing\s*page|web\s*page|webpage|html\s*page|basic\s*html|rust\s+web|web\s+server)\b/i

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
    /\b(docs?\s*(site|website)|documentation\s*(site|website)|full\s+docs|blink\s+docs)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }
  return false
}

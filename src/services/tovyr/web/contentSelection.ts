export const TOVYR_WEB_RESULT_MAX_CHARS = 16_000

function normalizeAnchor(value: string): string {
  return decodeURIComponent(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function headingLevel(line: string): number {
  const match = /^(#{1,6})\s+/.exec(line)
  return match?.[1]?.length ?? 0
}

function sectionForAnchor(markdown: string, anchor: string): string | null {
  const wanted = normalizeAnchor(anchor)
  if (!wanted) return null
  const lines = markdown.split(/\r?\n/)
  let inFence = false
  let start = -1
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    const level = inFence ? 0 : headingLevel(line)
    if (
      level > 0 &&
      normalizeAnchor(line.replace(/^#{1,6}\s+/, '')) === wanted
    ) {
      start = index
      break
    }
  }
  if (start < 0) return null
  const level = headingLevel(lines[start]!)
  let end = lines.length
  inFence = false
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index]!
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    const nextLevel = inFence ? 0 : headingLevel(line)
    if (nextLevel > 0 && nextLevel <= level) {
      end = index
      break
    }
  }
  return lines.slice(start, end).join('\n').trim()
}

function clip(content: string, maxChars: number): string {
  const cleaned = content
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
  if (cleaned.length <= maxChars) return cleaned
  return `${cleaned.slice(0, maxChars).trimEnd()}\n\n[Result clipped by Tovyr]`
}

/** Select a useful, bounded section without an extra model request. */
export function selectTovyrWebContent(
  markdown: string,
  url: string,
  maxChars = TOVYR_WEB_RESULT_MAX_CHARS,
): string {
  let anchor = ''
  try {
    anchor = new URL(url).hash.slice(1)
  } catch {
    // Keep the document fallback for malformed or non-URL targets.
  }
  const anchored = anchor ? sectionForAnchor(markdown, anchor) : null
  return clip(anchored || markdown, maxChars)
}

/** Repository roots can use the raw README instead of a 500KB GitHub shell. */
export function githubReadmeFastUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.toLowerCase() !== 'github.com') return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length !== 2) return null
    return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/HEAD/README.md`
  } catch {
    return null
  }
}

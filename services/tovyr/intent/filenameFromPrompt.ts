import { basename } from 'node:path'

const FILENAME_TOKEN_RE = /[\w./\\-]*[\w-]\.[A-Za-z0-9]{1,12}/g

function firstFilenameToken(text: string): string | null {
  const matches = text.match(FILENAME_TOKEN_RE)
  if (!matches) return null
  for (const m of matches) {
    if (/^\.+/.test(m)) continue
    const ext = m.slice(m.lastIndexOf('.') + 1)
    if (/^\d+$/.test(ext)) continue
    return basename(m)
  }
  return null
}

/** Infer target filename from the user's natural-language request. */
export function deriveFileNameFromPrompt(prompt: string): string | null {
  const trimmed = prompt.trim()
  if (!trimmed) return null

  const saveAs = trimmed.match(
    /(?:save\s+(?:as|to)|named?|called?|file(?:name)?)\s+[`"']?([^\s`"']+\.\w{1,12})/i,
  )
  if (saveAs?.[1]) return basename(saveAs[1])

  const explicit = firstFilenameToken(trimmed)
  if (explicit) return explicit

  if (/\bdashboard\b/i.test(trimmed)) return 'dashboard.html'
  if (
    /\b(docs?\s*(site|website)|documentation\s*(site|website)|full\s+(website\s+)?docs|tovyr\s+docs)\b/i.test(
      trimmed,
    )
  ) {
    return 'docs/index.html'
  }
  if (/\blanding\s*page\b/i.test(trimmed)) return 'landing_page.html'
  if (/\b(showcase|portfolio|agent\s+page)\b/i.test(trimmed)) return 'index.html'
  if (/\bwebsite\b/i.test(trimmed)) return 'index.html'
  if (/\bhome\s*page\b/i.test(trimmed)) return 'index.html'
  if (/\bhtml\b/i.test(trimmed)) return 'index.html'
  if (/\bmain\.rs\b/i.test(trimmed)) return 'main.rs'
  if (/\brust\b/i.test(trimmed) && /\b(web|server|api)\b/i.test(trimmed)) {
    return 'src/main.rs'
  }
  if (/\bcargo\.toml\b/i.test(trimmed)) return 'Cargo.toml'

  return null
}

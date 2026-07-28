/**
 * Convert HTML to readable markdown/text without requiring turndown at install time.
 * Prefers turndown when available; falls back to a lightweight stripper.
 */

type TurndownCtor = typeof import('turndown')

let turndownServicePromise: Promise<InstanceType<TurndownCtor>> | undefined

async function tryGetTurndownService(): Promise<InstanceType<TurndownCtor> | null> {
  if (turndownServicePromise) {
    try {
      return await turndownServicePromise
    } catch {
      return null
    }
  }
  turndownServicePromise = import('turndown')
    .then(m => {
      const Turndown = (m as unknown as { default: TurndownCtor }).default
      return new Turndown()
    })
    .catch(err => {
      turndownServicePromise = undefined
      throw err
    })
  try {
    return await turndownServicePromise
  } catch {
    return null
  }
}

/** Minimal HTML → markdown for when turndown is not installed. */
export function stripHtmlToMarkdown(html: string): string {
  let text = html
    // Drop scripts/styles/noscript entirely
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, '')
    // Headings
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => {
      const hashes = '#'.repeat(Math.min(6, Number(level) || 1))
      return `\n${hashes} ${decodeEntities(stripTags(body)).trim()}\n\n`
    })
    // Links
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, body) => {
      const label = decodeEntities(stripTags(body)).trim() || href
      return `[${label}](${href})`
    })
    // Images
    .replace(/<img\s+[^>]*alt=["']([^"']*)["'][^>]*>/gi, (_, alt) => (alt ? `![${alt}]` : ''))
    // Lists
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    // Paragraphs / breaks
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|tr|table|section|article)>/gi, '\n')
    // Code
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, body) => `\n\`\`\`\n${stripTags(body)}\n\`\`\`\n`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, body) => `\`${stripTags(body)}\``)
    // Bold / italic
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '_$2_')

  text = stripTags(text)
  text = decodeEntities(text)
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

export async function htmlToMarkdown(html: string): Promise<string> {
  const turndown = await tryGetTurndownService()
  if (turndown) {
    return turndown.turndown(html)
  }
  return stripHtmlToMarkdown(html)
}

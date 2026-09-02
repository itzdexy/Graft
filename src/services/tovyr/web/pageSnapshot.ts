/**
 * Raw page snapshot: HTML plus the stylesheets it links.
 *
 * `action=read` runs the page through `htmlToMarkdown`, which is right for
 * "what does this page say" and useless for "copy this site". Markdown keeps
 * prose and headings and discards every class, inline style, colour, font,
 * layout rule and asset URL — so an agent asked to clone a page could only
 * read a description of it and invent a lookalike from scratch. That is why
 * copying "worked" and produced something that shared no CSS with the original.
 *
 * This keeps the markup and the CSS, which is the minimum needed to reproduce
 * a page's appearance rather than its wording.
 */

/**
 * Budget for the whole snapshot.
 *
 * A real page is bigger than it looks: aside.com alone is ~326k chars of markup
 * plus 125k of CSS. The tool result is capped downstream, and truncation there
 * cuts from the end — which is exactly where the CSS sits, so an unbudgeted
 * snapshot loses the styling and keeps the markup, defeating the point.
 *
 * The split is deliberate: markup and styling are both required to reproduce a
 * page, so each gets a guaranteed share rather than competing first-come.
 */
export const MAX_HTML_CHARS = 60_000
export const MAX_CSS_CHARS = 60_000
/** Ceiling across every stylesheet combined, not per file. */
export const MAX_CSS_TOTAL_CHARS = 60_000
/** Stylesheet count cap — sites routinely link a dozen tiny files. */
export const MAX_STYLESHEETS = 8

/**
 * Ceiling for the whole tool result, with headroom for the section headers,
 * fences and truncation notes wrapped around the HTML and CSS budgets.
 */
export const TOVYR_WEB_SNAPSHOT_MAX_CHARS =
  MAX_HTML_CHARS + MAX_CSS_TOTAL_CHARS + 8_000

export type StylesheetRef = {
  /** Absolute URL to fetch. */
  url: string
  /** The href exactly as written in the document. */
  href: string
}

/** `<link rel="stylesheet" href="...">`, resolved against the page URL. */
export function extractStylesheetLinks(
  html: string,
  baseUrl: string,
): StylesheetRef[] {
  const refs: StylesheetRef[] = []
  const seen = new Set<string>()

  // Attribute order varies (`rel` before or after `href`), so match the whole
  // tag and inspect its attributes rather than assuming a fixed layout.
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0]
    if (!/\brel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue

    const hrefMatch = tag.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
    const href = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? '').trim()
    if (!href) continue

    let absolute: string
    try {
      absolute = new URL(href, baseUrl).toString()
    } catch {
      continue
    }
    // Only http(s). data: and blob: carry no extra information worth fetching,
    // and other schemes are not ours to follow.
    if (!/^https?:/i.test(absolute)) continue
    if (seen.has(absolute)) continue

    seen.add(absolute)
    refs.push({ url: absolute, href })
    if (refs.length >= MAX_STYLESHEETS) break
  }

  return refs
}

/** Contents of every `<style>` block, in document order. */
export function extractInlineStyles(html: string): string[] {
  const blocks: string[] = []
  for (const match of html.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
  )) {
    const body = (match[1] ?? '').trim()
    if (body) blocks.push(body)
  }
  return blocks
}

/** Page `<title>`, for labelling the snapshot. */
export function extractTitle(html: string): string {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  return (match?.[1] ?? '').replace(/\s+/g, ' ').trim()
}

function clip(value: string, max: number, label: string): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n\n/* [${label} truncated at ${max} chars of ${value.length}] */`
}

export type SnapshotStylesheet = {
  url: string
  css: string
}

export type SnapshotInput = {
  url: string
  html: string
  inlineStyles: string[]
  stylesheets: SnapshotStylesheet[]
}

/**
 * Assemble the snapshot the model sees.
 *
 * Fenced by kind so the model can tell markup from styling at a glance, and
 * each stylesheet is labelled with its source URL so relative asset paths
 * inside it can still be resolved.
 */
export function buildPageSnapshot(input: SnapshotInput): string {
  const title = extractTitle(input.html)
  const parts: string[] = [
    `Page snapshot: ${input.url}${title ? ` — ${title}` : ''}`,
    '',
    'This is the real markup and CSS, not a summary. Reproduce structure and',
    'styling from it rather than guessing from a description.',
    '',
    '## HTML',
    '```html',
    clip(input.html, MAX_HTML_CHARS, 'HTML'),
    '```',
  ]

  // CSS shares one budget across inline blocks and every linked sheet, spent in
  // document order. Without a shared ceiling a single large bundle would eat
  // the whole result and starve the sheets after it.
  let cssRemaining = MAX_CSS_TOTAL_CHARS

  const spendCss = (css: string, label: string): string => {
    if (cssRemaining <= 0) {
      return `/* [${label} omitted — CSS budget exhausted] */`
    }
    const slice = clip(css, Math.min(cssRemaining, MAX_CSS_CHARS), label)
    cssRemaining -= Math.min(css.length, cssRemaining)
    return slice
  }

  if (input.inlineStyles.length > 0) {
    parts.push('', '## Inline <style> blocks', '```css')
    parts.push(spendCss(input.inlineStyles.join('\n\n'), 'inline CSS'))
    parts.push('```')
  }

  for (const sheet of input.stylesheets) {
    parts.push('', `## Stylesheet: ${sheet.url}`, '```css')
    parts.push(spendCss(sheet.css, 'CSS'))
    parts.push('```')
  }

  if (input.stylesheets.length === 0 && input.inlineStyles.length === 0) {
    parts.push(
      '',
      'No stylesheets were found or fetched. Styling may be applied at runtime',
      '(CSS-in-JS or a bundler), so match the visual design from the markup.',
    )
  }

  return parts.join('\n')
}

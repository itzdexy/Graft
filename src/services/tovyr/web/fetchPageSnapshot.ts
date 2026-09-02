import { validateURL } from '../../../tools/WebFetchTool/utils.js'
import {
  buildPageSnapshot,
  extractInlineStyles,
  extractStylesheetLinks,
  MAX_CSS_CHARS,
  type SnapshotStylesheet,
} from './pageSnapshot.js'

/**
 * Fetch a page as markup + CSS rather than as prose.
 *
 * Deliberately separate from `getURLMarkdownContent`: that path caches the
 * markdown conversion, so reusing it would hand back the very thing that makes
 * cloning impossible. This keeps the bytes the server actually sent.
 */

const FETCH_TIMEOUT_MS = 20_000
/** A stylesheet that never returns must not hang the whole snapshot. */
const CSS_TIMEOUT_MS = 10_000

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Tovyr/1.0 Safari/537.36'

async function fetchText(
  url: string,
  timeoutMs: number,
  parentSignal: AbortSignal,
): Promise<{ ok: boolean; status: number; body: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer.unref?.()
  const onParentAbort = () => controller.abort()
  parentSignal.addEventListener('abort', onParentAbort, { once: true })
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
      signal: controller.signal,
      redirect: 'follow',
    })
    const body = await response.text()
    return { ok: response.ok, status: response.status, body }
  } finally {
    clearTimeout(timer)
    parentSignal.removeEventListener('abort', onParentAbort)
  }
}

/** Raw HTML plus every stylesheet it links, formatted for the model. */
export async function fetchTovyrPageSnapshot(
  url: string,
  abortController: AbortController,
): Promise<string> {
  if (!validateURL(url)) {
    throw new Error('Invalid or unsafe URL')
  }

  const page = await fetchText(url, FETCH_TIMEOUT_MS, abortController.signal)
  if (!page.ok) {
    throw new Error(`HTTP ${page.status}`)
  }

  const html = page.body
  const refs = extractStylesheetLinks(html, url)

  // Fetched together — a landing page commonly links several small files and
  // doing them in series makes the tool feel broken on a slow origin. One bad
  // stylesheet must not lose the whole snapshot, so failures are reported
  // inline rather than thrown.
  const stylesheets: SnapshotStylesheet[] = await Promise.all(
    refs.map(async (ref): Promise<SnapshotStylesheet> => {
      try {
        if (!validateURL(ref.url)) {
          return { url: ref.url, css: `/* skipped: unsafe URL */` }
        }
        const sheet = await fetchText(
          ref.url,
          CSS_TIMEOUT_MS,
          abortController.signal,
        )
        if (!sheet.ok) {
          return { url: ref.url, css: `/* fetch failed: HTTP ${sheet.status} */` }
        }
        return { url: ref.url, css: sheet.body.slice(0, MAX_CSS_CHARS) }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { url: ref.url, css: `/* fetch failed: ${message} */` }
      }
    }),
  )

  return buildPageSnapshot({
    url,
    html,
    inlineStyles: extractInlineStyles(html),
    stylesheets,
  })
}

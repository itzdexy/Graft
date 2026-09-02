import {
  currentUrl,
  launchLocalBrowser,
  navigate,
  readHtml,
  readText,
} from './localBrowser.js'
import { findChromium } from './chromiumFinder.js'

/**
 * Local URL check, deliberately not imported from TovyrWebTool.
 *
 * That module imports this one, so borrowing its `isPlausibleWebUrl` created a
 * require cycle between the tool and its own browser backend — the kind that
 * resolves fine until an unrelated import order change turns one side into
 * `undefined` at call time.
 */
function looksLikeUrl(target: string): boolean {
  const trimmed = target.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    )
    if (url.hostname.includes('.')) return true
    return url.hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)
  } catch {
    return false
  }
}

/** Rendered text is for reasoning; the full DOM would drown the context. */
const MAX_TEXT_CHARS = 24_000
/** Enough markup to see structure, not the whole render tree. */
const MAX_HTML_CHARS = 40_000
/** Port well clear of the 9222 a user's own debug session would take. */
const BROWSE_PORT = 9333

/**
 * Load a page in a real browser and report what it actually renders.
 *
 * The raw-fetch paths (`read`, `clone`) see only what the server sent. On a
 * client-rendered site — Next.js, Vite, anything that mounts into an empty
 * `<div id="root">` — that is a shell with no content, and the agent concludes
 * the page is blank. Running the page means scripts execute first, so this is
 * the honest answer to "what is on this page".
 */
export async function runLocalBrowserRead(
  target: string,
  signal: AbortSignal,
): Promise<string> {
  const trimmed = target.trim()
  if (!looksLikeUrl(trimmed)) {
    return (
      `"${target}" is not a URL. The local browser navigates to pages; it does not ` +
      `take natural-language tasks. Use action=search for queries, or pass a URL.`
    )
  }

  const browser = findChromium()
  if (!browser) {
    return (
      'No Chromium-family browser found for local browsing. Install Chrome, Edge ' +
      'or Brave, set TOVYR_BROWSER_PATH, or set BROWSER_USE_API_KEY for the ' +
      'cloud browser. action=read still works without a browser.'
    )
  }

  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let handle: Awaited<ReturnType<typeof launchLocalBrowser>> | null = null
  try {
    handle = await launchLocalBrowser(BROWSE_PORT)
    if (signal.aborted) return 'Browsing cancelled.'

    await navigate(handle.session, url)
    const [finalUrl, text, html] = await Promise.all([
      currentUrl(handle.session),
      readText(handle.session),
      readHtml(handle.session),
    ])

    const body = text.trim()
    const parts = [
      `Rendered ${finalUrl} in ${browser.name} (JavaScript executed).`,
      '',
      '## Visible text',
      body ? body.slice(0, MAX_TEXT_CHARS) : '(the page rendered no visible text)',
      '',
      '## Rendered HTML (post-JavaScript)',
      '```html',
      html.slice(0, MAX_HTML_CHARS),
      '```',
    ]
    return parts.join('\n')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `Local browser failed for ${url}: ${message}`
  } finally {
    // Always tear the browser down — a leaked headless process holds the debug
    // port and every later browse in the session would fail to bind it.
    handle?.close()
  }
}

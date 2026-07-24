/**
 * Blink Browser URL Safety
 *
 * Validates URLs before browser fetch operations to prevent security issues.
 * Blocks dangerous schemes (javascript:, file:, data:, etc.) and ensures
 * only http/https URLs are used for web browsing.
 *
 * @module services/blink/browser/urlSafety
 */

const BLOCKED_SCHEMES = new Set([
  'javascript',
  'file',
  'data',
  'vbscript',
  'blob',
])

export type BrowserUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string }

function trimUrl(raw: string): string {
  return raw.trim().replace(/^<|>$/g, '')
}

export function validateBrowserFetchUrl(raw: string): BrowserUrlValidation {
  const url = trimUrl(raw)
  if (!url) {
    return { ok: false, reason: 'No URL provided.' }
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return {
      ok: false,
      reason: `Invalid URL: ${url.slice(0, 200)}`,
    }
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase()
  if (BLOCKED_SCHEMES.has(scheme)) {
    return {
      ok: false,
      reason: `Blocked URL scheme "${scheme}:" — use http or https only.`,
    }
  }

  if (scheme !== 'http' && scheme !== 'https') {
    return {
      ok: false,
      reason: `Unsupported URL scheme "${scheme}:" — use http or https only.`,
    }
  }

  if (!parsed.hostname) {
    return { ok: false, reason: 'URL is missing a hostname.' }
  }

  return { ok: true, url: parsed.toString() }
}

export function formatBlockedBrowserUrlMessage(
  validation: Extract<BrowserUrlValidation, { ok: false }>,
): string {
  return [
    'Cannot fetch this URL for safety reasons.',
    validation.reason,
    '',
    'Use an http(s) link to public documentation or a trusted site.',
  ].join('\n')
}
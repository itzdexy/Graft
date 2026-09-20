/**
 * Graft Browser URL Safety
 *
 * Validates URLs before browser fetch operations to prevent security issues.
 * Blocks dangerous schemes (javascript:, file:, data:, etc.) and ensures
 * only http/https URLs are used for web browsing.
 *
 * @module services/graft/browser/urlSafety
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

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number)
  if (
    octets.length !== 4 ||
    octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return false
  }
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 0
  )
}

export function isPrivateBrowserHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    isPrivateIpv4(host) ||
    (host.includes(':') && (host.startsWith('fc') || host.startsWith('fd'))) ||
    host.startsWith('::ffff:') ||
    host.startsWith('fe80:')
  )
}

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

export function validateBrowserAutomationUrl(
  raw: string,
  options: { allowPrivateNetwork?: boolean } = {},
): BrowserUrlValidation {
  const result = validateBrowserFetchUrl(raw)
  if (!result.ok) return result
  const parsed = new URL(result.url)
  if (
    isPrivateBrowserHost(parsed.hostname) &&
    !options.allowPrivateNetwork &&
    process.env.GRAFT_BROWSER_ALLOW_PRIVATE_NETWORK !== '1'
  ) {
    return {
      ok: false,
      reason:
        'Private-network browser targets are blocked. Set GRAFT_BROWSER_ALLOW_PRIVATE_NETWORK=1 only for a trusted local project.',
    }
  }
  return result
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

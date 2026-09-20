import axios from 'axios'
import { getWebFetchUserAgent } from '../../../utils/http.js'

export type LocalSearchHit = {
  title: string
  url: string
  snippet?: string
}

export type LocalSearchResult = {
  query: string
  hits: LocalSearchHit[]
  durationSeconds: number
  provider: 'duckduckgo' | 'duckduckgo-instant'
  status?: 'ok' | 'empty' | 'unavailable'
}

type SearchTransport = (url: string, signal: AbortSignal) => Promise<unknown>
const requestSearch: SearchTransport = async (url, signal) => (await axios.get(url, {
  signal, timeout: SEARCH_TIMEOUT_MS, maxRedirects: 5, maxContentLength: 2_000_000,
  headers: { 'User-Agent': getWebFetchUserAgent() },
})).data

const SEARCH_TIMEOUT_MS = 20_000
const MAX_HITS = 8

/**
 * Local web search for providers that lack Anthropic server-side web_search
 * (OpenRouter, OpenAI, DeepSeek, FreeModel, custom OpenAI-compat, etc.).
 */
export async function runLocalWebSearch(
  query: string,
  signal?: AbortSignal,
  transport: SearchTransport = requestSearch,
): Promise<LocalSearchResult> {
  signal?.throwIfAborted()
  const start = performance.now()
  const deadline = AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline
  let failed = false
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return {
      query: trimmed,
      hits: [],
      durationSeconds: 0,
      provider: 'duckduckgo',
      status: 'empty',
    }
  }

  // Prefer HTML results (richer). Fall back to Instant Answer API.
  try {
    const hits = parseDuckDuckGoHtml(String(await transport(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`, requestSignal)))
    if (hits.length > 0) {
      return {
        query: trimmed,
        hits: hits.slice(0, MAX_HITS),
        durationSeconds: (performance.now() - start) / 1000,
        provider: 'duckduckgo',
        status: 'ok',
      }
    }
  } catch {
    signal?.throwIfAborted()
    failed = true
  }

  try {
    requestSignal.throwIfAborted()
    const data = await transport(`https://api.duckduckgo.com/?q=${encodeURIComponent(trimmed)}&format=json&no_html=1&skip_disambig=1`, requestSignal)
    const hits = parseDuckDuckGoInstant(data)
    // Empty Instant Answer (no Abstract / RelatedTopics) is a hard miss —
    // do not pretend we searched successfully when HTML SERP was also empty.
    if (hits.length > 0) {
      return {
        query: trimmed,
        hits: hits.slice(0, MAX_HITS),
        durationSeconds: (performance.now() - start) / 1000,
        provider: 'duckduckgo-instant',
        status: 'ok',
      }
    }
  } catch {
    signal?.throwIfAborted()
    failed = true
  }

  return {
    query: trimmed,
    hits: [],
    durationSeconds: (performance.now() - start) / 1000,
    provider: 'duckduckgo',
    status: failed ? 'unavailable' : 'empty',
  }
}

/** Parse DuckDuckGo HTML SERP into title/url/snippet triples. */
export function parseDuckDuckGoHtml(html: string): LocalSearchHit[] {
  const hits: LocalSearchHit[] = []
  // Each result block: result__a link + optional result__snippet
  const results = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].filter(match => /\bclass\s*=\s*["'][^"']*\bresult__a\b[^"']*["']/i.test(match[1]!))
  for (let i = 0; i < results.length; i++) {
    const match = results[i]!
    const rawHref = decodeBasicHtml(match[1]?.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1] ?? '')
    const title = decodeBasicHtml(stripTags(match[2] ?? '')).trim()
    const url = unwrapDuckDuckGoRedirect(rawHref)
    if (!url || !title || hits.some(hit => hit.url === url)) continue

    // Snippet: look ahead a bit for result__snippet
    const window = html.slice(match.index! + match[0].length, results[i + 1]?.index ?? html.length)
    const snipMatch = window.match(
      /class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|td|div)/i,
    )
    const snippet = snipMatch
      ? decodeBasicHtml(stripTags(snipMatch[1] ?? '')).trim()
      : undefined

    hits.push({ title, url, snippet: snippet || undefined })
    if (hits.length >= MAX_HITS) break
  }
  return hits
}

function unwrapDuckDuckGoRedirect(href: string): string {
  try {
    // Absolute or relative //duckduckgo.com/l/?uddg=...
    const absolute = href.startsWith('http')
      ? href
      : href.startsWith('//')
        ? `https:${href}`
        : href.startsWith('/')
          ? `https://duckduckgo.com${href}`
          : href
    const parsed = new URL(absolute)
    const uddg = (parsed.hostname === 'duckduckgo.com' || parsed.hostname.endsWith('.duckduckgo.com')) && parsed.searchParams.get('uddg')
    const target = uddg ? new URL(uddg) : parsed
    return /^https?:$/.test(target.protocol) && !target.username && !target.password ? target.href : ''
  } catch {
    return ''
  }
}

function parseDuckDuckGoInstant(raw: unknown): LocalSearchHit[] {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid search response')
  const data = raw as {
    AbstractText?: string
    AbstractURL?: string
    Heading?: string
    RelatedTopics?: Array<{
      Text?: string
      FirstURL?: string
      Topics?: Array<{ Text?: string; FirstURL?: string }>
    }>
    Results?: Array<{ Text?: string; FirstURL?: string }>
  }

  const hits: LocalSearchHit[] = []
  if (data.AbstractURL && (data.Heading || data.AbstractText)) {
    hits.push({
      title: data.Heading || data.AbstractURL,
      url: data.AbstractURL,
      snippet: data.AbstractText,
    })
  }
  for (const r of data.Results ?? []) {
    if (r.FirstURL && r.Text) {
      hits.push({ title: r.Text, url: r.FirstURL })
    }
  }
  for (const topic of data.RelatedTopics ?? []) {
    if (topic.FirstURL && topic.Text) {
      hits.push({ title: topic.Text, url: topic.FirstURL })
    }
    for (const nested of topic.Topics ?? []) {
      if (nested.FirstURL && nested.Text) {
        hits.push({ title: nested.Text, url: nested.FirstURL })
      }
    }
  }
  const seen = new Set<string>()
  return hits.flatMap(hit => {
    const url = unwrapDuckDuckGoRedirect(hit.url)
    if (!url || seen.has(url)) return []
    seen.add(url)
    return [{ ...hit, url }]
  })
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

function decodeBasicHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

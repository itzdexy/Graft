import { z } from 'zod/v4'
import { createElement } from 'react'
import { buildTool } from '../../Tool.js'
import {
  isBrowserUseConfigured,
  runBrowserUseTask,
} from '../../services/tovyr/browser/cloudClient.js'
import { runLocalWebSearch } from '../../services/tovyr/web/localWebSearch.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  getURLMarkdownContent,
} from '../WebFetchTool/utils.js'
import {
  selectTovyrWebContent,
  TOVYR_WEB_RESULT_MAX_CHARS,
} from '../../services/tovyr/web/contentSelection.js'
import { TOVYR_WEB_SNAPSHOT_MAX_CHARS } from '../../services/tovyr/web/pageSnapshot.js'
import { resolveContextualWebTarget } from '../../services/tovyr/web/contextualReference.js'
import { fetchTovyrPageSnapshot } from '../../services/tovyr/web/fetchPageSnapshot.js'
import { runLocalBrowserRead } from '../../services/tovyr/browser/localBrowserRead.js'
import { TovyrWebResultMessage } from '../../components/tovyr/TovyrWebResultMessage.js'

export const TOVYR_WEB_TOOL_NAME = 'TovyrWeb'

export type TovyrWebActivityMetadata = {
  operation: 'search' | 'read' | 'browse'
  query?: string
  sourceHost?: string
  resultCount?: number
  sourceHosts?: string[]
}

export function buildWebActivityMetadata(
  operation: TovyrWebActivityMetadata['operation'],
  target: string,
  hits: Array<{ url: string; title?: string; snippet?: string }> = [],
): TovyrWebActivityMetadata {
  if (operation === 'search') {
    const sourceHosts = [
      ...new Set(
        hits.flatMap(hit => {
          try {
            return [new URL(hit.url).hostname]
          } catch {
            return []
          }
        }),
      ),
    ].slice(0, 3)
    return {
      operation,
      query: target,
      resultCount: hits.length,
      sourceHosts,
    }
  }
  if (operation === 'read') {
    try {
      return { operation, sourceHost: new URL(target).hostname }
    } catch {
      return { operation }
    }
  }
  return { operation, query: target }
}

export function runtimeClockForSearch(
  query: string,
  now = new Date(),
): string | null {
  const asksForClock =
    /^(?:the\s+)?(?:time|date|now)$/i.test(query.trim()) ||
    /\b(?:current|local|right now|now|today)\b.*\b(?:time|date)\b|\b(?:time|date)\b.*\b(?:current|local|right now|now|today)\b/i.test(
      query,
    )
  if (!asksForClock) return null
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  return `Runtime clock (${timeZone}): ${now.toString()}`
}

/** True when target looks like a hostname/path after optional https:// prefix. */
export function isPlausibleWebUrl(target: string): boolean {
  const trimmed = target.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`
    const url = new URL(withScheme)
    if (!url.hostname || !url.hostname.includes('.')) {
      // Allow localhost and bare IPs without a dot TLD.
      if (
        url.hostname === 'localhost' ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) ||
        url.hostname.includes(':')
      ) {
        return true
      }
      return false
    }
    if (/[^a-zA-Z0-9.-]/.test(url.hostname.replace(/^\[|\]$/g, ''))) {
      return false
    }
    return true
  } catch {
    return false
  }
}

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z
      .enum(['read', 'clone', 'search', 'browse'])
      .describe(
        'read = page text as markdown; clone = raw HTML + CSS for reproducing a page; search = web search; browse = render a URL in a real local browser (JS runs)',
      ),
    target: z
      .string()
      .min(1)
      .describe('URL, search query, or natural-language browser task'),
  }),
)

const outputSchema = lazySchema(() =>
  z.object({
    output: z.string(),
    action: z.string(),
    activity: z
      .object({
        operation: z.enum(['search', 'read', 'browse']),
        query: z.string().optional(),
        sourceHost: z.string().optional(),
        resultCount: z.number().optional(),
        sourceHosts: z.array(z.string()).optional(),
      })
      .optional(),
  }),
)

export const TovyrWebTool = buildTool({
  name: TOVYR_WEB_TOOL_NAME,
  searchHint: 'web read, search, or interactive browse (Tovyr)',
  maxResultSizeChars: TOVYR_WEB_SNAPSHOT_MAX_CHARS,
  shouldDefer: true,
  isEnabled() {
    return isTovyrRuntime()
  },
  userFacingName() {
    return 'Web'
  },
  get inputSchema() {
    return inputSchema()
  },
  get outputSchema() {
    return outputSchema()
  },
  isConcurrencySafe() {
    return false
  },
  isReadOnly() {
    return true
  },
  async description(input) {
    return `Tovyr web ${input.action}: ${input.target.slice(0, 80)}`
  },
  async prompt() {
    return `Unified Tovyr web tool.
- action=search: run a live web search for target (query string)
- action=search also returns the local runtime clock for current time/date questions
- action=read: fetch and extract markdown from target (URL)
- action=clone: fetch the RAW HTML plus linked CSS for a URL. Use this — never
  action=read — when asked to copy, clone, recreate or rebuild a page's design.
  read returns markdown, which drops all layout, classes, colours and fonts, so
  a copy built from it is a guess rather than a reproduction.
- action=browse: load a URL in a REAL local browser (JavaScript runs). Use this
  when action=read or action=clone returns an empty shell — that means the site
  renders client-side. Falls back to the cloud browser if BROWSER_USE_API_KEY is set.
Never repeat the same target through another web tool; one successful result is sufficient.
Prefer this or WebSearch/WebFetch for current events — do not claim you lack web access.`
  },
  async checkPermissions(input) {
    return { behavior: 'allow', updatedInput: input }
  },
  async call(input, { abortController, messages }) {
    // Small OpenAI-compatible models sometimes choose action=read with a
    // target of "time". Resolve the intent here instead of turning it into
    // the invalid URL https://time.
    const runtimeClock = runtimeClockForSearch(input.target)
    if (runtimeClock) {
      return {
        data: {
          action: input.action,
          output: runtimeClock,
        },
      }
    }

    if (input.action === 'browse') {
      // A local Chromium the user already has, driven over CDP, beats telling
      // them to buy a cloud key. It also renders the page, so it is the only
      // path that works on client-rendered sites where a raw fetch returns an
      // empty shell.
      if (!isBrowserUseConfigured()) {
        const rendered = await runLocalBrowserRead(
          input.target,
          abortController.signal,
        )
        return {
          data: {
            action: input.action,
            output: rendered,
            activity: buildWebActivityMetadata('browse', input.target),
          },
        }
      }
      const output = await runBrowserUseTask(
        input.target,
        abortController.signal,
      )
      return { data: { action: input.action, output } }
    }

    if (input.action === 'search') {
      const local = await runLocalWebSearch(
        input.target,
        abortController.signal,
      )
      if (local.hits.length === 0) {
        return {
          data: {
            action: input.action,
            output: `No results for "${input.target}". DuckDuckGo HTML and Instant Answer both returned empty — try a shorter or more specific query, or action=read with a known URL.`,
          },
        }
      }
      const lines = local.hits.map(
        (h, i) =>
          `${i + 1}. ${h.title}\n   ${h.url}${h.snippet ? `\n   ${h.snippet}` : ''}`,
      )
      return {
        data: {
          action: input.action,
          output: `Web search for "${input.target}" (${local.provider}, ${local.durationSeconds.toFixed(1)}s):\n\n${lines.join('\n\n')}\n\nCite these URLs in your reply.`,
          activity: buildWebActivityMetadata(
            'search',
            input.target,
            local.hits,
          ),
        },
      }
    }

    // action=read
    const latestPrompt =
      [...messages]
        .reverse()
        .map(message => {
          if (message.type !== 'user' || !Array.isArray(message.message.content)) {
            return ''
          }
          return message.message.content
            .flatMap(block =>
              block.type === 'text' && 'text' in block ? [block.text] : [],
            )
            .join('\n')
        })
        .find(Boolean) ?? ''
    let url = resolveContextualWebTarget(
      input.target,
      messages,
      latestPrompt,
    )
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`
    }
    if (!isPlausibleWebUrl(url)) {
      return {
        data: {
          action: input.action,
          output:
            `Target "${input.target}" is not a usable URL. Use action=search for queries, or pass a full https:// URL (e.g. example.com/path).`,
        },
      }
    }
    if (input.action === 'clone') {
      try {
        const snapshot = await fetchTovyrPageSnapshot(url, abortController)
        return {
          data: {
            action: input.action,
            output: snapshot,
            activity: buildWebActivityMetadata('read', url),
          },
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return {
          data: {
            action: input.action,
            output: `Failed to snapshot ${url}: ${message}`,
          },
        }
      }
    }

    try {
      const fetched = await getURLMarkdownContent(url, abortController)
      if ('type' in fetched && fetched.type === 'redirect') {
        return {
          data: {
            action: input.action,
            output: `Redirect from ${fetched.originalUrl} → ${fetched.redirectUrl}. Retry with TovyrWeb action=read target="${fetched.redirectUrl}" if that host is trusted.`,
          },
        }
      }
      const content = selectTovyrWebContent(fetched.content, url)
      return {
        data: {
          action: input.action,
          output: `Fetched ${url} (${fetched.code} ${fetched.codeText}, ${fetched.bytes} bytes):\n\n${content}`,
          activity: buildWebActivityMetadata('read', url),
        },
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        data: {
          action: input.action,
          output: `Failed to fetch ${url}: ${message}`,
        },
      }
    }
  },
  mapToolResultToToolResultBlockParam({ output, action }, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: `[TovyrWeb ${action}]\n${output}`,
    }
  },
  renderToolUseMessage(input) {
    if (!input.action || !input.target) return null
    return `${input.action} ${input.target}`
  },
  renderToolResultMessage(output, _progress, { verbose }) {
    return createElement(TovyrWebResultMessage, {
      content: output,
      verbose,
    })
  },
})

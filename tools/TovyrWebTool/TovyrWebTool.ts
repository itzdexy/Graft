import { z } from 'zod/v4'
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
  MAX_MARKDOWN_LENGTH,
} from '../WebFetchTool/utils.js'

export const TOVYR_WEB_TOOL_NAME = 'TovyrWeb'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z
      .enum(['read', 'search', 'browse'])
      .describe(
        'read = static page fetch; search = web search; browse = interactive cloud browser',
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
  }),
)

export const TovyrWebTool = buildTool({
  name: TOVYR_WEB_TOOL_NAME,
  searchHint: 'web read, search, or interactive browse (Tovyr)',
  maxResultSizeChars: 100_000,
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
- action=read: fetch and extract markdown from target (URL)
- action=browse: interactive cloud browser when BROWSER_USE_API_KEY is set
Prefer this or WebSearch/WebFetch for current events — do not claim you lack web access.`
  },
  async checkPermissions(input) {
    return { behavior: 'allow', updatedInput: input }
  },
  async call(input, { abortController }) {
    if (input.action === 'browse') {
      if (!isBrowserUseConfigured()) {
        return {
          data: {
            action: input.action,
            output:
              'Browser Use not configured. Set BROWSER_USE_API_KEY or use action=read with a URL / action=search with a query.',
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
            output: `No results for "${input.target}". Try a different query or action=read with a known URL.`,
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
        },
      }
    }

    // action=read
    let url = input.target.trim()
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`
    }
    try {
      const fetched = await getURLMarkdownContent(url, abortController)
      if ('type' in fetched && fetched.type === 'redirect') {
        return {
          data: {
            action: input.action,
            output: `Redirect from ${fetched.originalUrl} to ${fetched.redirectUrl} (not auto-followed). Retry with the redirect URL if trusted.`,
          },
        }
      }
      const content =
        fetched.content.length > MAX_MARKDOWN_LENGTH
          ? fetched.content.slice(0, MAX_MARKDOWN_LENGTH) +
            '\n\n[Content truncated...]'
          : fetched.content
      return {
        data: {
          action: input.action,
          output: `Fetched ${url} (${fetched.code} ${fetched.codeText}, ${fetched.bytes} bytes):\n\n${content}`,
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
})

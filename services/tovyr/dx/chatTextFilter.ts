import {
  formatOpenCodeToolLine,
  type OpenCodeToolLine,
} from './activityDisplay.js'
import { basename } from 'node:path'

const BILLING_HEADER_RE = /^x-anthropic-billing-header:/i
const BILLING_HEADER_INLINE_RE = /x-anthropic-billing-header:[^\n]*/gi
const CC_ATTRIBUTION_RE = /cc_version=[^;\n]+;\s*cc_entrypoint=[^;\n]+/i
const NO_TASK_FALLBACK_RE =
  /^(?:tovyr\s+)?there\s+is\s+no\s+task\s+to\s+complete\.?$/i

const NARRATED_TOOL_RE =
  /\b(?:I(?:'ll| will)|(?:I'm|I am))\s+(?:use|using|call|calling)\s+(?:the\s+)?(Write|Edit|Read|Grep|Glob|Bash)\b/i
const NARRATED_TOOL_ALT_RE =
  /\bUsing\s+the\s+(Write|Edit|Read|Grep|Glob|Bash)\s+tool\b/i

const PSEUDO_FN_TOOL_RE =
  /^\s*(Write|Edit|Read|Grep|Glob|Bash)\s*\(\s*([\s\S]*)\)\s*\.{0,3}\s*$/i

function unquoteArg(raw: string): string {
  const t = raw.trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1)
  }
  return t
}

/** Weak models emit `Write(file_path="…", content="…")` as chat text. */
export function parsePseudoFunctionToolCall(
  text: string,
): { toolName: string; input: Record<string, unknown> } | null {
  const match = text.trim().match(PSEUDO_FN_TOOL_RE)
  if (!match?.[1] || !match[2]) return null
  const toolName = match[1]
  const args = match[2]
  const input: Record<string, unknown> = {}

  const filePath = args.match(/file_path\s*=\s*("([^"]*)"|'([^']*)'|([^,\s]+))/i)
  if (filePath) {
    const raw = filePath[2] ?? filePath[3] ?? filePath[4] ?? ''
    input.file_path = basename(unquoteArg(raw)) || raw
  }

  const pattern = args.match(/pattern\s*=\s*("([^"]*)"|'([^']*)')/i)
  if (pattern) {
    input.pattern = pattern[2] ?? pattern[3] ?? ''
  }

  const command = args.match(/command\s*=\s*("([^"]*)"|'([^']*)')/i)
  if (command) {
    input.command = command[2] ?? command[3] ?? ''
  }

  if (toolName === 'Write' || toolName === 'Edit' || toolName === 'Read') {
    if (!input.file_path && !input.pattern && !input.command) return null
  }

  return { toolName, input }
}

export function isPseudoFunctionToolLeak(text: string): boolean {
  return parsePseudoFunctionToolCall(text) !== null
}

/** Prefer prompt-shaped names when the model uses generic index.html. */
export function resolveTovyrWriteDisplayPath(
  filePath: string,
  context = '',
): string {
  const base = basename(filePath.trim()) || 'index.html'
  if (base !== 'index.html') return base
  const ctx = context.toLowerCase()
  if (/\blanding\s*page\b/.test(ctx)) return 'landing_page.html'
  if (/\bdashboard\b/.test(ctx)) return 'dashboard.html'
  return base
}

export function pseudoFunctionOpenCodeLine(
  text: string,
  inProgress = true,
): OpenCodeToolLine | null {
  const parsed = parsePseudoFunctionToolCall(text)
  if (!parsed) return null
  if (
    typeof parsed.input.file_path === 'string' &&
    (parsed.toolName === 'Write' || parsed.toolName === 'Edit')
  ) {
    parsed.input.file_path = resolveTovyrWriteDisplayPath(
      String(parsed.input.file_path),
      text,
    )
  }
  return formatOpenCodeToolLine(parsed.toolName, parsed.input, { inProgress })
}

/** System-prompt billing attribution echoed by weak OpenAI-compat models. */
export function isBillingHeaderLeak(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (BILLING_HEADER_RE.test(trimmed)) return true
  if (CC_ATTRIBUTION_RE.test(trimmed) && trimmed.length < 240) return true
  return false
}

export function stripBillingHeaderLeak(text: string): string {
  return text.replace(BILLING_HEADER_INLINE_RE, '').trim()
}

export function matchNarratedToolIntent(
  text: string,
): { toolName: string } | null {
  const trimmed = stripBillingHeaderLeak(text).trim()
  if (!trimmed) return null
  const alt = trimmed.match(NARRATED_TOOL_ALT_RE)
  if (alt?.[1]) return { toolName: alt[1] }
  const narr = trimmed.match(NARRATED_TOOL_RE)
  if (narr?.[1]) return { toolName: narr[1] }
  return null
}

function inferFilePathFromNarration(text: string): string | undefined {
  const html = text.match(
    /\b(?:create|creating|write|writing|save|saving)\s+(?:a\s+)?(?:basic\s+)?([\w.-]+\.html?)\b/i,
  )
  if (html?.[1]) return html[1]
  if (/\bdashboard\b/i.test(text)) return 'dashboard.html'
  if (/\blanding\s*page\b/i.test(text)) return 'landing_page.html'
  if (/\bindex\.html\b/i.test(text)) return 'index.html'
  return undefined
}

export function narratedToolOpenCodeLine(
  text: string,
  inProgress = true,
): OpenCodeToolLine | null {
  const match = matchNarratedToolIntent(text)
  if (!match) return null
  const filePath = inferFilePathFromNarration(text)
  const input: Record<string, unknown> = filePath ? { file_path: filePath } : {}
  return formatOpenCodeToolLine(match.toolName, input, { inProgress })
}

/** Remove billing leaks and narrated-tool noise from streamed assistant text. */
export function filterTovyrAssistantDisplayText(text: string): string {
  let cleaned = stripBillingHeaderLeak(text)
  if (NO_TASK_FALLBACK_RE.test(cleaned.trim())) {
    return 'Hi - what can I help you with today?'
  }
  if (matchNarratedToolIntent(cleaned)) {
    cleaned = cleaned
      .replace(NARRATED_TOOL_ALT_RE, '')
      .replace(NARRATED_TOOL_RE, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return cleaned
}

export function shouldHideTovyrAssistantText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (isBillingHeaderLeak(trimmed)) return true
  if (isPseudoFunctionToolLeak(trimmed)) return true
  if (matchNarratedToolIntent(trimmed)) return true
  const cleaned = filterTovyrAssistantDisplayText(trimmed)
  return !cleaned
}

export function filterTovyrStreamingPreview(text: string): string | null {
  if (isPseudoFunctionToolLeak(text)) return null
  const cleaned = filterTovyrAssistantDisplayText(text)
  if (!cleaned) {
    if (
      matchNarratedToolIntent(text) ||
      isBillingHeaderLeak(text) ||
      isPseudoFunctionToolLeak(text)
    ) {
      return null
    }
  }
  return cleaned || null
}

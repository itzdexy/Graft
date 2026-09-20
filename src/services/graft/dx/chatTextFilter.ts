import {
  formatOpenCodeToolLine,
  type OpenCodeToolLine,
} from './activityDisplay.js'
import { recoverNativeToolCalls } from '../openaiCompat/leakedToolSyntax.js'
import { basename } from 'node:path'

const BILLING_HEADER_RE = /^x-anthropic-billing-header:/i
const BILLING_HEADER_INLINE_RE = /x-anthropic-billing-header:[^\n]*/gi
const CC_ATTRIBUTION_RE = /cc_version=[^;\n]+;\s*cc_entrypoint=[^;\n]+/i
// A "There is no task to complete." reply used to be swapped for a canned
// greeting. That is ghostwriting: the transcript then shows words the model
// never produced, and it hides the real signal — a model that answers a
// greeting that way is a model worth replacing. Graft shows what the model
// actually said.
const ORCHESTRATION_MARKER_RE =
  /^\s*###\s+(?:ideas ready|plan ready|build complete|verification (?:approved|needs changes))\s*$/gim

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

/**
 * Small OpenAI-compatible models (Llama 3.1 8B and friends) frequently emit a
 * tool call as prose — `{"name": "AskUserQuestion", "parameters": {…}}` — or
 * wrapped in `<tool_call>` / `<function=…>` tags.
 *
 * The streaming converter recovers these into real tool calls, but by then the
 * text deltas have already reached the transcript and cannot be retracted, so
 * the raw JSON is rendered as if the model had said it. This is the display-side
 * half of that recovery. It delegates to the same parser the converter uses so
 * the two cannot disagree about what counts as a leak.
 */
export function parseJsonToolCallLeak(
  text: string,
): { toolName: string; input: Record<string, unknown>; prose: string } | null {
  const trimmed = text.trim()
  // Cheap guard: never run a JSON parse over ordinary prose.
  if (
    !trimmed.startsWith('{') &&
    !trimmed.includes('<tool_call') &&
    !trimmed.includes('<function=')
  ) {
    return null
  }
  const { cleanText, toolUses } = recoverNativeToolCalls(trimmed)
  const first = toolUses[0]
  if (!first) return null
  return { toolName: first.name, input: first.input, prose: cleanText.trim() }
}

export function isJsonToolCallLeak(text: string): boolean {
  return parseJsonToolCallLeak(text) !== null
}

/** Compact tool row standing in for a leaked JSON tool call. */
export function jsonToolCallLeakOpenCodeLine(
  text: string,
  inProgress = false,
): OpenCodeToolLine | null {
  const parsed = parseJsonToolCallLeak(text)
  if (!parsed) return null
  return formatOpenCodeToolLine(parsed.toolName, parsed.input, {
    inProgress,
    ok: true,
  })
}

/** Prefer prompt-shaped names when the model uses generic index.html. */
export function resolveGraftWriteDisplayPath(
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
    parsed.input.file_path = resolveGraftWriteDisplayPath(
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
/**
 * Scratchpad sections some models append to every answer: a "Memory updates"
 * block addressed to themselves, and file manifests the model then disowns
 * ("the above files are hypothetical"). Both read as completed work when they
 * are not, which is worse than saying nothing.
 */
const HYPOTHETICAL_DISCLAIMER_RE =
  /^\s*note:\s*the above files are hypothetical[^\n]*$/im
const FILE_MANIFEST_HEADING_RE =
  /\n?\s*(?:created\/changed files|created or changed files|files created)\s*:?\s*\n[\s\S]*$/i

/**
 * A "Memory updates" heading, in prose or as a list item. Everything indented
 * beneath it is the model talking to itself about goals and decisions.
 */
const MEMORY_HEADING_RE = /^\s*(?:[-*]\s*)?(?:#{1,3}\s*)?memory updates?\s*:?\s*$/i
/**
 * Status bookkeeping that restates what the tool row already shows. Dropped as
 * single lines so genuinely useful siblings — an `- Error:` bullet carrying the
 * real failure — survive.
 */
const TASK_BOOKKEEPING_RE =
  /^\s*(?:[-*]\s*)?(?:#{1,3}\s*)?(?:task (?:progress|status)|status)\s*:.*$|^\s*(?:[-*]\s*)?(?:#{1,3}\s*)?task (?:progress|status)\s*:?\s*$/i
/** `- Output: (see output file)` restates a tool row and names a file the user has no path to. */
const OUTPUT_PLACEHOLDER_RE = /^\s*[-*]\s*output\s*:\s*\(see output file\)\s*$/i
/** Continuation of a bookkeeping block: a blank line or a deeper bullet. */
const BULLET_RE = /^\s*[-*]\s+/

/**
 * Removes self-addressed bookkeeping the model appended to a real answer.
 *
 * Line-based rather than one big regex: these blocks appear mid-message, as
 * bullets, and more than once per turn, and an earlier "strip from the heading
 * to end of message" approach deleted the actual error along with them.
 */
export function stripAssistantSlopSections(text: string): string {
  let cleaned = text
  // A manifest the model disowns describes nothing that happened — drop the
  // whole section rather than presenting invented paths as created files.
  if (HYPOTHETICAL_DISCLAIMER_RE.test(cleaned)) {
    cleaned = cleaned.replace(FILE_MANIFEST_HEADING_RE, '')
    cleaned = cleaned.replace(HYPOTHETICAL_DISCLAIMER_RE, '')
  }

  const kept: string[] = []
  let inMemoryBlock = false
  for (const line of cleaned.split('\n')) {
    if (MEMORY_HEADING_RE.test(line)) {
      inMemoryBlock = true
      continue
    }
    if (inMemoryBlock) {
      // Its bullets and the blank lines between them belong to the block.
      if (!line.trim() || BULLET_RE.test(line)) continue
      inMemoryBlock = false
    }
    if (TASK_BOOKKEEPING_RE.test(line)) continue
    if (OUTPUT_PLACEHOLDER_RE.test(line)) continue
    kept.push(line)
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function filterGraftAssistantDisplayText(text: string): string {
  // Strip a leaked tool call first so any surrounding prose still renders,
  // rather than the whole turn collapsing to raw JSON.
  const jsonLeak = parseJsonToolCallLeak(text)
  let cleaned = stripAssistantSlopSections(
    stripBillingHeaderLeak(jsonLeak ? jsonLeak.prose : text).replace(
      ORCHESTRATION_MARKER_RE,
      '',
    ),
  ).trim()
  if (matchNarratedToolIntent(cleaned)) {
    cleaned = cleaned
      .replace(NARRATED_TOOL_ALT_RE, '')
      .replace(NARRATED_TOOL_RE, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return cleaned
}

export function shouldHideGraftAssistantText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (isBillingHeaderLeak(trimmed)) return true
  if (isPseudoFunctionToolLeak(trimmed)) return true
  if (isJsonToolCallLeak(trimmed)) return true
  if (matchNarratedToolIntent(trimmed)) return true
  const cleaned = filterGraftAssistantDisplayText(trimmed)
  return !cleaned
}

export function filterGraftStreamingPreview(text: string): string | null {
  if (isPseudoFunctionToolLeak(text)) return null
  // A partially streamed tool call looks like `{"name": "…` — never preview it.
  if (isJsonToolCallLeak(text)) return null
  if (text.trimStart().startsWith('{') && text.includes('"name"')) return null
  const cleaned = filterGraftAssistantDisplayText(text)
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

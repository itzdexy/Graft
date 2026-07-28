import type { Theme } from '../../../utils/theme.js'
import { getDisplayPath } from '../../../utils/file.js'
import { mcpInfoFromString } from '../../mcp/mcpStringUtils.js'
import figures from 'figures'
import sample from 'lodash-es/sample.js'
import { TURN_COMPLETION_VERBS } from '../../../constants/turnCompletionVerbs.js'
import { isTovyrAccurateSpinnerEnabled } from '../../../constants/spinnerVerbs.js'
import { formatNumber } from '../../../utils/format.js'
import { escalateWaitStatusLabel } from './waitStateCopy.js'

export type ToolActivityKind =
  | 'write'
  | 'edit'
  | 'read'
  | 'search'
  | 'bash'
  | 'other'

const WRITE_TOOLS = new Set(['Write', 'NotebookEdit'])
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit'])
const READ_TOOLS = new Set(['Read', 'LS', 'Glob'])
const SEARCH_TOOLS = new Set(['Grep', 'Agent'])
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch', 'TovyrWeb'])
const AGENT_TOOLS = new Set(['Agent', 'Task'])
const MCP_SUMMARY_KEYS = [
  'query',
  'q',
  'url',
  'path',
  'file_path',
  'name',
  'title',
  'id',
]

export function classifyTool(toolName: string): ToolActivityKind {
  if (WRITE_TOOLS.has(toolName)) return 'write'
  if (EDIT_TOOLS.has(toolName)) return 'edit'
  if (READ_TOOLS.has(toolName)) return 'read'
  if (SEARCH_TOOLS.has(toolName)) return 'search'
  if (toolName === 'Bash' || toolName === 'PowerShell') return 'bash'
  return 'other'
}

function prettyMcpSegment(value: string): string {
  return value.replace(/_/g, '-')
}

export function formatToolDisplayName(toolName: string): string {
  const mcpInfo = mcpInfoFromString(toolName)
  if (!mcpInfo) return toolName

  const server = prettyMcpSegment(mcpInfo.serverName)
  const tool = prettyMcpSegment(mcpInfo.toolName ?? 'tool')
  return `${server}/${tool}`
}

function summarizeMcpInput(input: Record<string, unknown>): string {
  for (const key of MCP_SUMMARY_KEYS) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      const text = value.trim().replace(/\s+/g, ' ')
      return text.length > 60 ? `${text.slice(0, 57)}...` : text
    }
  }

  const first = Object.entries(input).find(
    ([, value]) => typeof value === 'string' && value.trim(),
  )
  if (first) {
    const [, value] = first
    const text = String(value).trim().replace(/\s+/g, ' ')
    return text.length > 60 ? `${text.slice(0, 57)}...` : text
  }

  return ''
}

export function summarizeToolInput(
  toolName: string,
  input: Record<string, unknown>,
): string {
  if (mcpInfoFromString(toolName)) {
    return summarizeMcpInput(input)
  }
  if (
    (toolName === 'Bash' || toolName === 'PowerShell') &&
    typeof input.command === 'string'
  ) {
    const cmd = input.command.trim().replace(/\s+/g, ' ')
    return cmd.length > 72 ? `${cmd.slice(0, 69)}...` : cmd
  }
  if (
    (WRITE_TOOLS.has(toolName) ||
      EDIT_TOOLS.has(toolName) ||
      READ_TOOLS.has(toolName)) &&
    typeof input.file_path === 'string'
  ) {
    return getDisplayPath(input.file_path)
  }
  if (READ_TOOLS.has(toolName) && typeof input.path === 'string') {
    return getDisplayPath(input.path)
  }
  if (toolName === 'Grep' && typeof input.pattern === 'string') {
    const pattern = input.pattern
    return pattern.length > 48 ? `${pattern.slice(0, 45)}...` : pattern
  }
  if (toolName === 'Glob' && typeof input.pattern === 'string') {
    return input.pattern
  }
  if (toolName === 'WebFetch' && typeof input.url === 'string') {
    const url = input.url.trim()
    return url.length > 72 ? `${url.slice(0, 69)}...` : url
  }
  if (toolName === 'WebSearch' && typeof input.query === 'string') {
    const q = input.query.trim()
    return q.length > 60 ? `${q.slice(0, 57)}...` : q
  }
  if (toolName === 'TovyrWeb') {
    const action =
      typeof input.action === 'string' ? input.action.trim() : ''
    const target =
      typeof input.target === 'string' ? input.target.trim() : ''
    const label = [action, target].filter(Boolean).join(' ')
    return label.length > 60 ? `${label.slice(0, 57)}...` : label
  }
  if (toolName === 'Agent' && typeof input.description === 'string') {
    const desc = input.description.trim()
    return desc.length > 60 ? `${desc.slice(0, 57)}...` : desc
  }
  const first = Object.values(input).find(v => typeof v === 'string')
  if (typeof first === 'string') {
    const text = first.trim()
    return text.length > 60 ? `${text.slice(0, 57)}...` : text
  }
  return ''
}

export function activityVerb(
  kind: ToolActivityKind,
  inProgress: boolean,
): string {
  if (inProgress) {
    switch (kind) {
      case 'write':
        return 'Writing'
      case 'edit':
        return 'Editing'
      case 'read':
        return 'Reading'
      case 'search':
        return 'Searching'
      case 'bash':
        return 'Running'
      default:
        return 'Using'
    }
  }
  switch (kind) {
    case 'write':
      return 'Wrote'
    case 'edit':
      return 'Edited'
    case 'read':
      return 'Read'
    case 'search':
      return 'Searched'
    case 'bash':
      return 'Ran'
    default:
      return 'Used'
  }
}

export function activityGlyph(
  kind: ToolActivityKind,
  inProgress: boolean,
  ok = true,
): string {
  if (inProgress) return '~'
  if (!ok) return '!'
  switch (kind) {
    case 'write':
      return '+'
    case 'edit':
      return '*'
    case 'bash':
      return '$'
    default:
      return '.'
  }
}

export function activityColor(
  kind: ToolActivityKind,
  inProgress: boolean,
  ok = true,
): keyof Theme {
  if (!ok) return 'warning'
  if (inProgress) return 'warning'
  switch (kind) {
    case 'write':
    case 'edit':
      return 'success'
    case 'bash':
      return 'tovyrPrimary'
    default:
      return 'text'
  }
}

export function formatActivityLine(
  toolName: string,
  summary: string,
  options: { inProgress?: boolean; ok?: boolean } = {},
): { verb: string; detail: string; glyph: string; color: keyof Theme } {
  const inProgress = options.inProgress ?? false
  const ok = options.ok ?? true
  if (toolName === 'status') {
    return {
      verb: summary,
      detail: '',
      glyph: '~',
      color: 'warning',
    }
  }
  const kind = classifyTool(toolName)
  const detail = summary || formatToolDisplayName(toolName)
  return {
    verb: activityVerb(kind, inProgress),
    detail,
    glyph: activityGlyph(kind, inProgress, ok),
    color: activityColor(kind, inProgress, ok),
  }
}

/** OpenCode-style inline tool row: * Grep, -> Read, ~ pending, + Write */
export type OpenCodeToolLine = {
  prefix: string
  text: string
  color: keyof Theme
  inProgress: boolean
}

function openCodeInProgressText(
  toolName: string,
  input: Record<string, unknown>,
): string {
  const summary = summarizeToolInput(toolName, input)
  const kind = classifyTool(toolName)
  if (kind === 'search') {
    if (toolName === 'Glob') return `Glob "${summary}"`
    return `Grep "${summary}"`
  }
  if (kind === 'read') {
    if (toolName === 'LS') return `List ${summary || toolName}`
    return `Read ${summary || toolName}`
  }
  if (kind === 'write') return `Write ${summary || toolName}`
  if (kind === 'edit') return `Edit ${summary || toolName}`
  if (kind === 'bash') {
    const shell = toolName === 'PowerShell' ? 'pwsh' : 'bash'
    return summary ? `${shell} · ${summary}` : shell
  }
  return summary || toolName
}

export function formatOpenCodeToolLine(
  toolName: string,
  input: Record<string, unknown>,
  options: {
    inProgress?: boolean
    ok?: boolean
    matchCount?: number
    nested?: boolean
  } = {},
): OpenCodeToolLine {
  const inProgress = options.inProgress ?? false
  const ok = options.ok ?? true
  const nested = options.nested ?? false
  const summary = summarizeToolInput(toolName, input)
  const kind = classifyTool(toolName)
  const displayName = formatToolDisplayName(toolName)
  const mcpInfo = mcpInfoFromString(toolName)

  /** Codex-style label: `Bash(date)`, `Read(path)`, … */
  const codexLabel = (name: string, arg?: string): string => {
    const a = (arg ?? '').trim()
    if (!a) return name
    const clipped = a.length > 64 ? `${a.slice(0, 61)}…` : a
    return `${name}(${clipped})`
  }

  if (toolName === 'status') {
    const text =
      typeof input.label === 'string'
        ? input.label
        : typeof input._ === 'string'
          ? input._
          : 'Working...'
    return {
      prefix: inProgress ? '○' : '●',
      text,
      color: 'warning',
      inProgress,
    }
  }

  const statusPrefix = inProgress ? '○' : '●'
  const statusColor: OpenCodeToolLine['color'] = inProgress
    ? 'warning'
    : !ok
      ? 'error'
      : 'success'

  if (mcpInfo) {
    return {
      prefix: statusPrefix,
      text: codexLabel(`MCP ${displayName}`, summary),
      color: statusColor,
      inProgress,
    }
  }

  if (WEB_TOOLS.has(toolName)) {
    return {
      prefix: statusPrefix,
      text: codexLabel(toolName, summary),
      color: statusColor,
      inProgress,
    }
  }

  if (AGENT_TOOLS.has(toolName)) {
    const desc = summary || toolName
    return {
      prefix: statusPrefix,
      text:
        toolName === 'Agent'
          ? codexLabel('Explore', desc)
          : codexLabel(displayName, desc),
      color: statusColor,
      inProgress,
    }
  }

  if (kind === 'search') {
    const countSuffix =
      options.matchCount != null && !inProgress && ok
        ? ` · ${options.matchCount} match${options.matchCount === 1 ? '' : 'es'}`
        : ''
    const name = toolName === 'Glob' ? 'Glob' : 'Grep'
    return {
      prefix: nested ? '·' : statusPrefix,
      text: `${codexLabel(name, summary)}${countSuffix}`,
      color: statusColor,
      inProgress,
    }
  }

  if (kind === 'read') {
    const name = toolName === 'LS' ? 'List' : 'Read'
    const text = !ok
      ? `${codexLabel(name, summary)} unavailable`
      : codexLabel(name, summary)
    return {
      prefix: nested ? '·' : statusPrefix,
      text,
      color: !ok ? 'warning' : statusColor,
      inProgress,
    }
  }

  if (kind === 'write' || kind === 'edit') {
    const name = kind === 'write' ? 'Write' : 'Edit'
    return {
      prefix: statusPrefix,
      text: codexLabel(name, summary),
      color: statusColor,
      inProgress,
    }
  }

  if (kind === 'bash') {
    const shell = toolName === 'PowerShell' ? 'PowerShell' : 'Bash'
    return {
      prefix: statusPrefix,
      text: codexLabel(shell, summary),
      color: statusColor,
      inProgress,
    }
  }

  return {
    prefix: statusPrefix,
    text: codexLabel(displayName, summary),
    color: statusColor,
    inProgress,
  }
}

/** Session epilogue: tokens, context %, cost (OpenCode footer pattern). */
export function formatSessionStatsLine(options: {
  model?: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  elapsedMs?: number
  contextTokens?: number
}): string {
  const parts: string[] = []
  if (options.model) parts.push(options.model)
  const sessionTotal =
    (options.inputTokens ?? 0) + (options.outputTokens ?? 0)
  const context = options.contextTokens ?? 0
  const displayTokens = Math.max(sessionTotal, context)
  if (displayTokens > 0) {
    parts.push(`${displayTokens.toLocaleString()} tokens`)
  }
  if (options.costUsd != null && options.costUsd > 0) {
    parts.push(`$${options.costUsd.toFixed(2)}`)
  }
  if (options.elapsedMs != null && options.elapsedMs > 0) {
    const s = options.elapsedMs / 1000
    parts.push(s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`)
  }
  return parts.join(' · ')
}

/**
 * OpenCode header metrics: `39,413  20%  ($0.29)`
 * Inspired by OpenCode / Codex session chrome.
 */
export function formatOpenCodeMetricsLine(options: {
  tokens?: number
  contextWindow?: number
  costUsd?: number
}): string {
  const parts: string[] = []
  const tokens = options.tokens ?? 0
  if (tokens > 0) {
    parts.push(tokens.toLocaleString())
  }
  const window = options.contextWindow ?? 0
  if (tokens > 0 && window > 0) {
    const pct = Math.min(100, Math.round((tokens / window) * 100))
    parts.push(`${pct}%`)
  }
  if (options.costUsd != null && options.costUsd > 0) {
    parts.push(`($${options.costUsd.toFixed(2)})`)
  }
  return parts.join('  ')
}

/** OpenCode task title: `# Homepage button color change…` */
export function formatOpenCodeTaskTitle(title: string, maxLen = 56): string {
  const clean = title.trim().replace(/\s+/g, ' ')
  if (!clean) return '# Session'
  const body = clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean
  return body.startsWith('#') ? body : `# ${body}`
}

/** Pull match/file counts from Grep/Glob tool results for OpenCode-style suffixes. */
export function extractToolMatchCount(toolResult: unknown): number | undefined {
  if (!toolResult || typeof toolResult !== 'object') return undefined
  const r = toolResult as Record<string, unknown>
  if (typeof r.numMatches === 'number' && Number.isFinite(r.numMatches)) {
    return r.numMatches
  }
  if (typeof r.numFiles === 'number' && Number.isFinite(r.numFiles)) {
    return r.numFiles
  }
  if (typeof r.numLines === 'number' && Number.isFinite(r.numLines)) {
    return r.numLines
  }
  return undefined
}

/** One-line Codex-style result preview under `Bash(cmd)` → └ output. */
export function extractToolResultPreview(toolResult: unknown): string | undefined {
  if (toolResult == null) return undefined
  if (typeof toolResult === 'string') {
    const t = toolResult.trim().replace(/\s+/g, ' ')
    return t ? (t.length > 100 ? `${t.slice(0, 97)}…` : t) : undefined
  }
  if (typeof toolResult !== 'object') return undefined
  const r = toolResult as Record<string, unknown>
  const stdout = typeof r.stdout === 'string' ? r.stdout : undefined
  const stderr = typeof r.stderr === 'string' ? r.stderr : undefined
  const raw = (stdout?.trim() || stderr?.trim() || '').replace(/\s+/g, ' ')
  if (!raw) return undefined
  return raw.length > 100 ? `${raw.slice(0, 97)}…` : raw
}

/** Footer cheat-sheet (OpenCode / Gemini CLI / Codex pattern). Keep short. */
export function formatOpenCodeShortcutHints(): string {
  return 'esc interrupt · ctrl+p commands'
}

/** OpenCode-style thought timing row: `+ Thought: 589ms` */
export function formatOpenCodeThoughtLine(
  durationMs?: number,
  inProgress = false,
): OpenCodeToolLine {
  const text =
    durationMs != null && durationMs > 0
      ? `Thought: ${durationMs < 1000 ? `${durationMs}ms` : durationMs < 10000 ? `${(durationMs / 1000).toFixed(1)}s` : `${Math.round(durationMs / 1000)}s`}`
      : 'Thought'
  return {
    prefix: '+',
    text,
    color: inProgress ? 'warning' : 'text',
    inProgress,
  }
}

/** OpenCode input epilogue: `Build * Big Pickle` */
export function formatOpenCodeEpilogue(modeLabel: string, model?: string): string {
  const parts = [modeLabel]
  if (model?.trim()) parts.push(model.trim())
  return parts.join(' · ')
}

/** Turn footnote for the dock: `* Baked for 30s · Code · model` */
export function formatTovyrTurnFootnote(options: {
  durationMs: number
  verb: string
  modeLabel?: string
  model?: string
}): string {
  const ms = options.durationMs
  const duration =
    ms < 1000
      ? `${ms}ms`
      : ms < 10_000
        ? `${(ms / 1000).toFixed(1)}s`
        : `${Math.round(ms / 1000)}s`
  const parts = [`${options.verb} for ${duration}`]
  const epilogue = formatOpenCodeEpilogue(options.modeLabel ?? '', options.model)
  if (epilogue.trim()) parts.push(epilogue)
  return parts.join(' · ')
}

/** Full dock footnote including optional token budget (replaces scrollback turn_duration in Tovyr). */
export function buildTovyrTurnFootnote(options: {
  durationMs: number
  budget?: { tokens: number; limit: number; nudges: number }
  modeLabel?: string
  model?: string
  verb?: string
  showDuration?: boolean
}): string {
  const showDuration = options.showDuration ?? true
  const verb = options.verb ?? sample(TURN_COMPLETION_VERBS) ?? 'Worked'
  const segments: string[] = []

  if (showDuration) {
    segments.push(
      formatTovyrTurnFootnote({
        durationMs: options.durationMs,
        verb,
        modeLabel: options.modeLabel,
        model: options.model,
      }),
    )
  } else {
    const epilogue = formatOpenCodeEpilogue(options.modeLabel ?? '', options.model)
    if (epilogue.trim()) segments.push(epilogue)
  }

  if (options.budget) {
    const { tokens, limit, nudges } = options.budget
    const usage =
      tokens >= limit
        ? `${formatNumber(tokens)} used (${formatNumber(limit)} min ${figures.tick})`
        : `${formatNumber(tokens)} / ${formatNumber(limit)} (${Math.round((tokens / limit) * 100)}%)`
    const nudgePart =
      nudges > 0 ? ` · ${nudges} ${nudges === 1 ? 'nudge' : 'nudges'}` : ''
    segments.push(`${usage}${nudgePart}`)
  }

  const body = segments.filter(Boolean).join(' · ')
  return body ? `* ${body}` : ''
}

/** Map stream phase to a human-readable live status (dock feed). */
export function formatTovyrLiveStatusLabel(options: {
  streamMode?: string
  elapsedMs?: number
  tokenEstimate?: number
  spinnerVerb?: string
}): string {
  const parts: string[] = []
  const useAccurate = isTovyrAccurateSpinnerEnabled()

  if (!useAccurate && options.spinnerVerb && options.streamMode !== 'tool-use') {
    parts.push(options.spinnerVerb)
  } else {
    switch (options.streamMode) {
      case 'requesting':
        parts.push('Connecting to model')
        break
      case 'thinking':
        parts.push('Thinking')
        break
      case 'tool-input':
        parts.push('Preparing tool call')
        break
      case 'tool-use':
        parts.push('Running tools')
        break
      case 'responding':
        parts.push(
          options.tokenEstimate && options.tokenEstimate > 0
            ? 'Generating response'
            : 'Waiting for first token',
        )
        break
      default:
        parts.push('Waiting for model')
    }
  }

  // After ~5s with no tokens, replace the silent clock with actionable copy.
  const escalated = escalateWaitStatusLabel(
    options.streamMode,
    options.elapsedMs,
    parts[0] ?? '',
  )
  if (escalated) {
    return escalated
  }

  if (options.elapsedMs != null && options.elapsedMs > 0) {
    const ms = options.elapsedMs
    const elapsed =
      ms < 1000
        ? `${ms}ms`
        : ms < 10_000
          ? `${(ms / 1000).toFixed(1)}s`
          : `${Math.round(ms / 1000)}s`
    parts.push(elapsed)
  }
  return parts.join(' · ')
}

/** Map Tovyr permission mode to OpenCode-style labels (Build vs code). */
export function openCodeModeLabel(
  permissionMode: string | undefined,
  inputMode: string,
): string {
  if (inputMode === 'bash') return 'Bash'
  switch (permissionMode) {
    case 'plan':
      return 'Plan'
    case 'acceptEdits':
      return 'Code'
    case 'bypassPermissions':
      return 'Bypass'
    case 'dontAsk':
      return 'Auto'
    default:
      return 'Ask'
  }
}

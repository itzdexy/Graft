export type ToolPresentationStatus =
  | 'queued'
  | 'waiting-approval'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type ToolPresentationCategory =
  | 'read'
  | 'search'
  | 'shell'
  | 'edit'
  | 'web'
  | 'mcp'
  | 'agent'
  | 'other'

export type ToolDetailMode = 'smart' | 'compact' | 'expanded'
export type ToolRisk = 'none' | 'low' | 'medium' | 'high'

export type ToolPresentation = {
  id?: string
  name: string
  category: ToolPresentationCategory
  label: string
  status: ToolPresentationStatus
  inputSummary: string
  resultSummary?: string
  detail?: string
  durationMs?: number
  count?: number
  matchCount?: number
  exitCode?: number
  risk: ToolRisk
  expandable: boolean
}

type BuildOptions = {
  id?: string
  toolName: string
  input?: Record<string, unknown>
  status?: ToolPresentationStatus
  resultSummary?: string
  detail?: string
  durationMs?: number
  count?: number
  matchCount?: number
  exitCode?: number
  risk?: ToolRisk
}

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const compact = (value: string, max = 160): string => {
  const oneLine = value.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

export function classifyTool(name: string): ToolPresentationCategory {
  const value = name.toLowerCase()
  if (/^(read|view|list)|file.*read/.test(value)) return 'read'
  if (/grep|glob|search|find/.test(value)) return 'search'
  if (/bash|shell|powershell|command|exec/.test(value)) return 'shell'
  if (/write|edit|patch|notebook/.test(value)) return 'edit'
  if (/web|fetch|browse|url/.test(value)) return 'web'
  if (/agent|task/.test(value)) return 'agent'
  if (/mcp|__/.test(value)) return 'mcp'
  return 'other'
}

function first(input: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(input[key])
    if (value) return value
  }
  return ''
}

export function summarizeToolInput(
  category: ToolPresentationCategory,
  input: Record<string, unknown>,
): string {
  switch (category) {
    case 'shell':
      return compact(first(input, ['command', 'cmd', 'script']) || 'command')
    case 'read':
    case 'edit':
      return compact(first(input, ['file_path', 'path', 'filename']) || 'file')
    case 'search': {
      const pattern = first(input, ['pattern', 'query', 'search'])
      const path = first(input, ['path', 'directory', 'cwd'])
      return compact([pattern, path].filter(Boolean).join(' in ') || 'workspace')
    }
    case 'web':
      return compact(first(input, ['url', 'query', 'q']) || 'web request')
    case 'mcp':
      return compact(first(input, ['tool', 'name', 'server']) || 'MCP call')
    case 'agent':
      return compact(first(input, ['description', 'prompt', 'task']) || 'agent task')
    default:
      return compact(
        first(input, ['description', 'path', 'query', 'command']) || 'request',
      )
  }
}

export function buildToolPresentation(options: BuildOptions): ToolPresentation {
  const input = options.input ?? {}
  const category = classifyTool(options.toolName)
  const status = options.status ?? 'queued'
  return {
    id: options.id,
    name: options.toolName,
    category,
    label: options.toolName.replace(/^mcp__/, '').replaceAll('__', ' / '),
    status,
    inputSummary: summarizeToolInput(category, input),
    resultSummary: options.resultSummary,
    detail: options.detail,
    durationMs: options.durationMs,
    count: options.count,
    matchCount: options.matchCount,
    exitCode: options.exitCode,
    risk: options.risk ?? 'none',
    expandable:
      Boolean(options.detail || options.resultSummary) ||
      status === 'failed' ||
      status === 'waiting-approval',
  }
}

export function shouldExpandTool(
  tool: ToolPresentation,
  mode: ToolDetailMode,
): boolean {
  if (mode === 'expanded') return tool.expandable
  if (mode === 'compact') return false
  return (
    tool.status === 'failed' ||
    tool.status === 'waiting-approval' ||
    tool.risk === 'high'
  )
}

export function formatDuration(durationMs?: number): string {
  if (durationMs == null) return ''
  return durationMs < 1000
    ? `${Math.round(durationMs)}ms`
    : `${(durationMs / 1000).toFixed(1)}s`
}

export function summarizeToolGroup(tools: ToolPresentation[]): string {
  const counts = new Map<ToolPresentationCategory, number>()
  for (const tool of tools) {
    counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1)
  }
  const labels: Record<ToolPresentationCategory, string> = {
    read: 'Read',
    search: 'Searched',
    shell: 'Ran',
    edit: 'Updated',
    web: 'Browsed',
    mcp: 'Called',
    agent: 'Ran',
    other: 'Used',
  }
  const nouns: Record<ToolPresentationCategory, string> = {
    read: 'files',
    search: 'patterns',
    shell: 'commands',
    edit: 'files',
    web: 'pages',
    mcp: 'MCP tools',
    agent: 'agents',
    other: 'tools',
  }
  return [...counts.entries()]
    .map(([category, count]) => `${labels[category]} ${count} ${nouns[category]}`)
    .join(' · ')
}

export type ToolActivityEntry = {
  toolName: string
  summary: string
  ok: boolean
  durationMs?: number
  at: number
}

export type TimelineEventKind =
  | 'session'
  | 'phase'
  | 'step'
  | 'reflection'
  | 'tool'
  | 'verify'

export type TimelineEvent = {
  at: number
  kind: TimelineEventKind
  label: string
  detail?: string
}

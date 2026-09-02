export type TovyrActivityKind =
  | 'ideating'
  | 'planning'
  | 'thinking'
  | 'searching'
  | 'reading_source'
  | 'coding'
  | 'running_tool'
  | 'streaming'
  | 'waiting_for_permission'
  | 'handoff'
  | 'verifying'
  | 'recovering'
  | 'failed'
  | 'complete'

export type TovyrActivityEvidence = {
  key: string
  label: string
  detail?: string
  state: 'active' | 'done' | 'failed'
}

export type TovyrTurnActivity = {
  kind: TovyrActivityKind
  status: 'active' | 'failed' | 'complete'
  label: string
  startedAt: number
  updatedAt: number
  evidence: TovyrActivityEvidence[]
  detail?: string
}

export type TovyrTurnActivityEvent =
  | { type: 'ideating'; label: string; at: number }
  | { type: 'planning'; label: string; at: number }
  | { type: 'thinking'; label: string; at: number }
  | { type: 'streaming'; label: string; detail?: string; at: number }
  | { type: 'search_started'; query: string; at: number }
  | { type: 'source_read'; host: string; title?: string; at: number }
  | {
      type: 'tool_started'
      toolName: string
      summary?: string
      at: number
    }
  | { type: 'permission_requested'; summary: string; at: number }
  | { type: 'handoff'; role: string; model?: string; at: number }
  | { type: 'verifying'; label: string; at: number }
  | { type: 'recovering'; label: string; at: number }
  | { type: 'failed'; label: string; detail?: string; at: number }

function presentation(event: TovyrTurnActivityEvent): {
  kind: TovyrActivityKind
  label: string
  detail?: string
} {
  switch (event.type) {
    case 'ideating':
      return { kind: 'ideating', label: event.label }
    case 'planning':
      return { kind: 'planning', label: event.label }
    case 'thinking':
      return { kind: 'thinking', label: event.label }
    case 'streaming':
      return { kind: 'streaming', label: event.label, detail: event.detail }
    case 'search_started':
      return { kind: 'searching', label: `Search · ${event.query}` }
    case 'source_read':
      return {
        kind: 'reading_source',
        label: `Read · ${event.host}`,
        detail: event.title,
      }
    case 'tool_started':
      return {
        kind: /^(write|edit|multiedit|notebookedit)$/i.test(event.toolName)
          ? 'coding'
          : 'running_tool',
        label: event.summary
          ? `${event.toolName} · ${event.summary}`
          : event.toolName,
      }
    case 'permission_requested':
      return {
        kind: 'waiting_for_permission',
        label: `Approval needed · ${event.summary}`,
      }
    case 'handoff':
      return {
        kind: 'handoff',
        label: event.model
          ? `${event.role} · ${event.model}`
          : `Handoff · ${event.role}`,
      }
    case 'verifying':
      return { kind: 'verifying', label: event.label }
    case 'recovering':
      return { kind: 'recovering', label: event.label }
    case 'failed':
      return { kind: 'failed', label: event.label, detail: event.detail }
  }
}

function addEvidence(
  evidence: TovyrActivityEvidence[],
  item: TovyrActivityEvidence,
): TovyrActivityEvidence[] {
  const withoutDuplicate = evidence.filter(existing => existing.key !== item.key)
  return [...withoutDuplicate, item]
}

export function reduceTurnActivity(
  current: TovyrTurnActivity | null,
  event: TovyrTurnActivityEvent,
): TovyrTurnActivity {
  const next = presentation(event)
  const samePhase =
    current?.status === 'active' &&
    current.kind === next.kind &&
    current.label === next.label
  const evidence =
    current && current.status === 'active' && !samePhase
      ? addEvidence(current.evidence, {
          key: `${current.kind}:${current.label}`,
          label: current.label,
          detail: current.detail,
          state: current.kind === 'failed' ? 'failed' : 'done',
        })
      : current?.evidence ?? []

  return {
    kind: next.kind,
    status: next.kind === 'failed' ? 'failed' : 'active',
    label: next.label,
    detail: next.detail,
    startedAt: current?.startedAt ?? event.at,
    updatedAt: event.at,
    evidence,
  }
}

export function completeTurnActivity(
  current: TovyrTurnActivity,
  at: number,
): TovyrTurnActivity {
  const evidence = addEvidence(current.evidence, {
    key: `${current.kind}:${current.label}`,
    label: current.label,
    detail: current.detail,
    state: current.status === 'failed' ? 'failed' : 'done',
  })
  return {
    ...current,
    kind: 'complete',
    status: 'complete',
    label: 'Complete',
    detail: undefined,
    updatedAt: at,
    evidence,
  }
}

import {
  reduceTurnActivity,
  type TovyrTurnActivity,
  type TovyrTurnActivityEvent,
} from './turnActivity.js'
import type { OrchestrationState } from '../agent/types.js'

export type ActivityAdapterInput = {
  at: number
  isLoading: boolean
  isProcessing?: boolean
  streamMode: string
  permissionPending?: boolean
  statusOverride?: string | null
  thinkingLabel?: string | null
  /**
   * Rotating playful verb ("Rizzing", "Cooking"). Supplied by the caller so it
   * stays stable across renders; generated here it would re-roll every frame.
   */
  spinnerVerb?: string | null
  hasStreamingText?: boolean
  streamingCharacterCount?: number
  orchestrationState?: OrchestrationState
  activeTool?: {
    name: string
    summary?: string
    input?: Record<string, unknown>
    web?: {
      operation: 'search' | 'read' | 'browse'
      query?: string
      url?: string
      sourceHost?: string
    }
  } | null
}

type ActiveTool = NonNullable<ActivityAdapterInput['activeTool']>
type WebActivity = NonNullable<ActiveTool['web']>

function cleanInputText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = value.trim()
  return clean || undefined
}

function sourceHost(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname || undefined
  } catch {
    return undefined
  }
}

/** Infer semantic web activity only from facts present in the tool input. */
function webActivityForTool(tool: ActiveTool): WebActivity | undefined {
  if (tool.web) return tool.web

  const input = tool.input ?? {}
  if (tool.name === 'WebSearch') {
    return {
      operation: 'search',
      query: cleanInputText(input.query),
    }
  }

  if (tool.name === 'WebFetch') {
    const url = cleanInputText(input.url)
    return {
      operation: 'read',
      url,
      sourceHost: sourceHost(url),
    }
  }

  if (tool.name !== 'TovyrWeb') return undefined

  const target = cleanInputText(input.target)
  if (input.action === 'read') {
    return {
      operation: 'read',
      url: target,
      sourceHost: sourceHost(target),
    }
  }
  if (input.action === 'browse') {
    return { operation: 'browse', query: target }
  }
  return { operation: 'search', query: target }
}

export function deriveTurnActivity(
  input: ActivityAdapterInput,
): TovyrTurnActivity | null {
  let event: TovyrTurnActivityEvent | null = null
  const activeTool = input.activeTool ?? undefined
  const webActivity = activeTool ? webActivityForTool(activeTool) : undefined

  if (input.permissionPending) {
    event = {
      type: 'permission_requested',
      summary: 'Continue the requested action',
      at: input.at,
    }
  } else if (webActivity?.operation === 'search') {
    event = {
      type: 'search_started',
      query: webActivity.query ?? activeTool?.summary ?? 'the web',
      at: input.at,
    }
  } else if (webActivity?.operation === 'read') {
    event = {
      type: 'source_read',
      host:
        webActivity.sourceHost ??
        webActivity.url ??
        activeTool?.summary ??
        'source',
      at: input.at,
    }
  } else if (activeTool) {
    event = {
      type: 'tool_started',
      toolName: activeTool.name,
      summary: activeTool.summary,
      at: input.at,
    }
  } else if (input.streamMode === 'thinking') {
    // The reasoning text itself now streams into the transcript, so echoing a
    // truncated copy of it here printed the same sentence twice, once in the
    // conversation and once above the composer. This row keeps the status.
    event = {
      type: 'thinking',
      label: input.spinnerVerb?.trim() || 'Thinking',
      at: input.at,
    }
  } else if (input.hasStreamingText) {
    event = {
      type: 'streaming',
      label: 'Streaming response',
      detail:
        input.streamingCharacterCount && input.streamingCharacterCount > 0
          ? `${input.streamingCharacterCount.toLocaleString()} chars`
          : undefined,
      at: input.at,
    }
  } else if (
    input.isLoading &&
    (input.orchestrationState === 'ideating' ||
      input.orchestrationState === 'awaiting_idea')
  ) {
    event = { type: 'ideating', label: 'Shaping approaches', at: input.at }
  } else if (
    input.isLoading &&
    (input.orchestrationState === 'drafting_plan' ||
      input.orchestrationState === 'awaiting_plan')
  ) {
    event = { type: 'planning', label: 'Drafting the plan', at: input.at }
  } else if (input.isProcessing && !input.isLoading) {
    event = {
      type: 'thinking',
      label: input.statusOverride?.trim() || 'Sending',
      at: input.at,
    }
  } else if (input.isLoading) {
    // A playful verb stands in for the generic waiting states. The literal
    // phase is still reachable via TOVYR_ACCURATE_SPINNER=1, which stops the
    // caller supplying a verb at all.
    const label =
      input.statusOverride?.trim() ||
      input.spinnerVerb?.trim() ||
      (input.streamMode === 'requesting'
        ? 'Connecting to model'
        : input.streamMode === 'tool-input'
          ? 'Preparing tool call'
          : 'Waiting for model')
    event = { type: 'thinking', label, at: input.at }
  }

  return event ? reduceTurnActivity(null, event) : null
}

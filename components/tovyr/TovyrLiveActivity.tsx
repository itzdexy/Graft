import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import { Box, Text } from '../../ink.js'
import type { Message } from '../../types/message.js'
import type { StreamingToolUse } from '../../utils/messages.js'
import { parseLooseToolArguments } from '../../services/tovyr/openaiCompat/toolNormalization.js'
import type { SpinnerMode } from '../Spinner.js'
import {
  formatOpenCodeToolLine,
  formatTovyrLiveStatusLabel,
  summarizeToolInput,
  type OpenCodeToolLine,
} from '../../services/tovyr/dx/activityDisplay.js'
import {
  filterTovyrStreamingPreview,
  narratedToolOpenCodeLine,
  pseudoFunctionOpenCodeLine,
} from '../../services/tovyr/dx/chatTextFilter.js'
import { lastTovyrCommittedAssistantDisplayText } from '../../services/tovyr/dx/tovyrTranscriptCollapse.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import {
  isTovyrAccurateSpinnerEnabled,
  pickSpinnerVerb,
} from '../../constants/spinnerVerbs.js'
import { TovyrTreeRow } from './TovyrTreeRow.js'
import { useAppState } from '../../state/AppState.js'
import {
  getProviderConnectionSnapshot,
  subscribeProviderConnection,
} from '../../services/tovyr/providers/connectionStore.js'
import { deriveTurnActivity } from '../../services/tovyr/dx/activityAdapter.js'
import { TovyrActivitySurface } from './TovyrActivitySurface.js'
import type { OrchestrationState } from '../../services/tovyr/agent/types.js'
/** How long a playful spinner verb holds before re-rolling. */
const VERB_ROTATE_MS = 4_000
const MAX_IN_PROGRESS = 1
const MAX_RESPONSE_PREVIEW = 520
const MAX_STREAMING_TOOL_INPUT = 16 * 1024

type InProgressTool = {
  id: string
  name: string
  input: Record<string, unknown>
}

type ActivityRow = {
  key: string
  line?: OpenCodeToolLine
  nested?: boolean
  spinnerStatus?: { label: string }
}

export function shouldShowTovyrGenericStatus(options: {
  isLoading: boolean
  suppressIdleStatus: boolean
  concreteRowCount: number
  showThought: boolean
  streamMode: SpinnerMode
  showSpinner?: boolean
  /** Live response tokens are already shown — don't duplicate with Connecting/Generating. */
  hasStreamingPreview?: boolean
}): boolean {
  if (options.suppressIdleStatus) return false
  if (options.concreteRowCount > 0) return false
  if (options.hasStreamingPreview) return false
  if (options.showThought && options.streamMode === 'thinking') return false
  if (options.showSpinner) return true
  return options.isLoading
}

/** True when streaming prose is already fully present in the transcript. */
export function isTovyrStreamingPreviewDuplicate(
  prose: string,
  committed: string | null,
): boolean {
  const p = prose.trim()
  const c = (committed ?? '').trim()
  if (!p || !c) return false
  if (p === c) return true
  // Still catching up to a committed block — hide until stream goes past it.
  if (c.startsWith(p)) return true
  return false
}

type Props = {
  messages: Message[]
  inProgressToolUseIDs: Set<string>
  isLoading: boolean
  isProcessing?: boolean
  suppressIdleStatus?: boolean
  loadingStartTimeRef?: RefObject<number>
  epilogue?: string
  thoughtDurationMs?: number
  showThought?: boolean
  streamMode?: SpinnerMode
  streamingToolUses?: StreamingToolUse[]
  responseLengthRef?: RefObject<number>
  thinkingPreview?: string | null
  streamingTextPreview?: string | null
  statusOverride?: string | null
  activeToolCount?: number
  showSpinner?: boolean
  turnFootnote?: string | null
  /** Permission mode for buddy mood (talk vs laptop). */
  permissionMode?: string
  permissionPending?: boolean
  orchestrationState?: OrchestrationState
}

function collectStreamingTools(
  streamingToolUses: StreamingToolUse[],
  skipIds: Set<string>,
): InProgressTool[] {
  return streamingToolUses
    .filter(stu => !skipIds.has(stu.contentBlock.id))
    .map(stu => {
      const raw =
        stu.unparsedToolInput ||
        (stu.contentBlock.input
          ? JSON.stringify(stu.contentBlock.input)
          : '')
      // Re-parsing an unbounded partial JSON payload for every network delta
      // causes quadratic work. Large inputs still show the tool immediately;
      // its finalized message supplies the complete parsed input.
      const parsed =
        raw.length <= MAX_STREAMING_TOOL_INPUT
          ? parseLooseToolArguments(raw)
          : {}
      const input =
        Object.keys(parsed).length > 0
          ? parsed
          : ((stu.contentBlock.input as Record<string, unknown>) ?? {})
      return {
        id: stu.contentBlock.id,
        name: stu.contentBlock.name,
        input,
      }
    })
}

export function compactLivePreview(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  const tail = oneLine.slice(-(max - 2))
  const firstSpace = tail.indexOf(' ')
  return `… ${firstSpace > 0 && firstSpace < max * 0.4 ? tail.slice(firstSpace + 1) : tail}`
}

function collectInProgressTools(
  messages: Message[],
  inProgressToolUseIDs: Set<string>,
): InProgressTool[] {
  if (inProgressToolUseIDs.size === 0) return []
  const found: InProgressTool[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg?.type !== 'assistant') continue
    for (const block of msg.message.content) {
      if (block.type !== 'tool_use') continue
      if (!inProgressToolUseIDs.has(block.id)) continue
      const input =
        block.input && typeof block.input === 'object'
          ? (block.input as Record<string, unknown>)
          : {}
      found.push({
        id: block.id,
        name: block.name,
        input,
      })
    }
    if (found.length >= inProgressToolUseIDs.size) break
  }
  return found.reverse()
}

function streamingToolLine(streamingText: string): OpenCodeToolLine | null {
  return (
    pseudoFunctionOpenCodeLine(streamingText, true) ??
    narratedToolOpenCodeLine(streamingText, true)
  )
}

/**
 * OpenCode-style live turn feed — thinking, status, in-progress tools, and streaming preview.
 */
export function TovyrLiveActivity({
  messages,
  inProgressToolUseIDs,
  isLoading,
  isProcessing = false,
  suppressIdleStatus = false,
  loadingStartTimeRef,
  epilogue,
  showThought = false,
  streamMode = 'responding',
  streamingToolUses = [],
  thinkingPreview,
  streamingTextPreview,
  statusOverride,
  activeToolCount = 0,
  showSpinner = false,
  turnFootnote,
  permissionPending = false,
  orchestrationState,
}: Props): ReactNode {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [sessionVerb, setSessionVerb] = useState<string | null>(null)
  const providerConnection = useSyncExternalStore(
    subscribeProviderConnection,
    getProviderConnectionSnapshot,
    getProviderConnectionSnapshot,
  )
  const messageCount = messages.length

  useEffect(() => {
    if (!isLoading) {
      setSessionVerb(null)
      return
    }
    // Literal phase labels are opt-in via TOVYR_ACCURATE_SPINNER=1.
    if (isTovyrAccurateSpinnerEnabled()) return
    // Re-roll periodically. A single verb pinned for a multi-minute turn reads
    // as a hang; changing copy is the cheapest signal that work is ongoing.
    setSessionVerb(pickSpinnerVerb())
    const timer = setInterval(() => setSessionVerb(pickSpinnerVerb()), VERB_ROTATE_MS)
    return () => clearInterval(timer)
  }, [isLoading])

  useEffect(() => {
    if (!isLoading || !loadingStartTimeRef?.current) {
      setElapsedMs(0)
      return
    }
    const tick = () => {
      const start = loadingStartTimeRef.current
      if (!start) return
      setElapsedMs(Math.max(0, Date.now() - start))
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [isLoading, loadingStartTimeRef])

  const inProgressKey = useMemo(
    () => [...inProgressToolUseIDs].sort().join(','),
    [inProgressToolUseIDs],
  )

  const streamingKey = useMemo(
    () =>
      streamingToolUses
        .map(stu => `${stu.contentBlock.id}:${stu.unparsedToolInput.length}`)
        .join('|'),
    [streamingToolUses],
  )

  const streamPreviewKey = streamingTextPreview?.length ?? 0

  const responseStreamPreview = useMemo((): string | null => {
    if (!isTovyrRuntime()) return null
    const streamText = streamingTextPreview?.trim() ?? ''
    if (!streamText) return null
    // Tool-shaped leaks render as tool rows, not prose.
    if (streamingToolLine(streamText)) return null
    const prose = filterTovyrStreamingPreview(streamText)
    if (!prose) return null
    const committed = lastTovyrCommittedAssistantDisplayText(messages)
    if (isTovyrStreamingPreviewDuplicate(prose, committed)) return null
    return compactLivePreview(prose, MAX_RESPONSE_PREVIEW)
  }, [messages, streamPreviewKey, streamingTextPreview])

  const activeTool = useMemo((): InProgressTool | null => {
    const fromMessages = collectInProgressTools(messages, inProgressToolUseIDs)
    const messageIds = new Set(fromMessages.map(tool => tool.id))
    const fromStream = collectStreamingTools(streamingToolUses, messageIds)
    return [...fromStream, ...fromMessages].at(-1) ?? null
  }, [messages, inProgressKey, streamingKey, streamingToolUses])

  const rows = useMemo((): ActivityRow[] => {
    if (!isTovyrRuntime()) return []

    const out: ActivityRow[] = []
    if (permissionPending) {
      out.push({
        key: 'permission',
        spinnerStatus: { label: 'Waiting for approval' },
      })
      return out
    }
    const streamText = streamingTextPreview?.trim() ?? ''

    if (streamText) {
      const leakedTool = streamingToolLine(streamText)
      if (leakedTool) {
        out.push({ key: 'stream-tool', line: leakedTool })
      }
    }

    const fromMessages = collectInProgressTools(messages, inProgressToolUseIDs)
    const messageIds = new Set(fromMessages.map(t => t.id))
    const fromStream = collectStreamingTools(streamingToolUses, messageIds)
    const merged = [...fromStream, ...fromMessages]
    for (const tool of merged.slice(-MAX_IN_PROGRESS)) {
      out.push({
        key: tool.id,
        line: formatOpenCodeToolLine(tool.name, tool.input, {
          inProgress: true,
        }),
      })
    }
    if (isProcessing && !isLoading && !suppressIdleStatus && out.length === 0) {
      out.push({
        key: 'sending',
        spinnerStatus: { label: 'Sending' },
      })
    }

    if (
      shouldShowTovyrGenericStatus({
        isLoading,
        suppressIdleStatus,
        concreteRowCount: out.length,
        showThought,
        streamMode,
        showSpinner,
        hasStreamingPreview: !!responseStreamPreview,
      })
    ) {
      const label =
        statusOverride?.trim() ||
        (activeToolCount > 0 && streamMode === 'tool-use'
          ? `Running ${activeToolCount} tool${activeToolCount === 1 ? '' : 's'}`
          : formatTovyrLiveStatusLabel({
              streamMode,
              elapsedMs,
              tokenEstimate: responseStreamPreview ? 1 : 0,
              spinnerVerb: sessionVerb ?? undefined,
              connectionState: providerConnection.state,
            }))
      if (label) {
        out.push({
          key: 'status',
          spinnerStatus: { label },
        })
      }
    }

    return out
  }, [
    messages,
    inProgressKey,
    streamingKey,
    streamPreviewKey,
    streamingTextPreview,
    streamingToolUses,
    isLoading,
    isProcessing,
    suppressIdleStatus,
    elapsedMs,
    streamMode,
    statusOverride,
    activeToolCount,
    sessionVerb,
    showThought,
    showSpinner,
    responseStreamPreview,
    permissionPending,
    providerConnection.state,
  ])

  // Tool rows (not the generic status) suppress thinking/response snippets.
  const hasToolRows = rows.some(r => r.line != null)

  const thinkingSnippet =
    thinkingPreview?.trim() && showThought && !hasToolRows
      ? compactLivePreview(thinkingPreview, MAX_RESPONSE_PREVIEW)
      : null

  const statusRows = rows.filter(row => row.spinnerStatus)
  const firstStatus = statusRows[0]
  const reducedMotion =
    useAppState(s => s.settings.prefersReducedMotion) ?? false
  const liveActivity = deriveTurnActivity({
    at: Date.now(),
    isLoading: isLoading && !suppressIdleStatus,
    isProcessing,
    streamMode,
    permissionPending,
    statusOverride: firstStatus?.spinnerStatus?.label ?? statusOverride,
    spinnerVerb: sessionVerb,
    thinkingLabel: thinkingSnippet
      ? compactLivePreview(thinkingSnippet, 120)
      : undefined,
    hasStreamingText: !!responseStreamPreview,
    streamingCharacterCount: streamingTextPreview?.length,
    orchestrationState,
    activeTool: activeTool
      ? {
          name: activeTool.name,
          summary: summarizeToolInput(activeTool.name, activeTool.input),
          input: activeTool.input,
        }
      : null,
  })

  const hasLiveContent =
    !!liveActivity ||
    !!epilogue ||
    !!turnFootnote?.trim()

  if (!hasLiveContent) {
    return null
  }

  return (
    <Box flexDirection="column" marginTop={0} marginBottom={0} paddingX={0}>
      {liveActivity ? (
        <TovyrActivitySurface
          activity={liveActivity}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {epilogue ? (
        <Box flexDirection="row" marginTop={0} paddingX={1}>
          <Text color="tovyrPrimary" dimColor bold>
            <Text color="tovyrPrimary">{'| '}</Text>{epilogue}
          </Text>
        </Box>
      ) : null}
      {turnFootnote ? (
        <TovyrTreeRow>
          <Text dimColor color="subtle">
            <Text color="tovyrPrimary" bold>{'| '}</Text>
            {turnFootnote}
          </Text>
        </TovyrTreeRow>
      ) : null}
    </Box>
  )
}

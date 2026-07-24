import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react'
import { Box, Text } from '../../ink.js'
import type { Message } from '../../types/message.js'
import type { StreamingToolUse } from '../../utils/messages.js'
import { parseLooseToolArguments } from '../../services/blink/openaiCompat/toolNormalization.js'
import type { SpinnerMode } from '../Spinner.js'
import {
  getBlinkLiveTokenEstimate,
  getBlinkSessionTokenTotal,
} from '../../services/blink/dx/tokenDisplay.js'
import {
  formatOpenCodeToolLine,
  formatOpenCodeThoughtLine,
  formatBlinkLiveStatusLabel,
  type OpenCodeToolLine,
} from '../../services/blink/dx/activityDisplay.js'
import {
  filterBlinkStreamingPreview,
  narratedToolOpenCodeLine,
  pseudoFunctionOpenCodeLine,
} from '../../services/blink/dx/chatTextFilter.js'
import { lastBlinkCommittedAssistantDisplayText } from '../../services/blink/dx/blinkTranscriptCollapse.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import {
  isBlinkAccurateSpinnerEnabled,
  pickSpinnerVerb,
} from '../../constants/spinnerVerbs.js'
import { BlinkSpinnerStatusRow } from './BlinkSpinnerStatusRow.js'
import { BlinkTreeRow } from './BlinkTreeRow.js'
import {
  ActivityClawd,
  resolveClawdMood,
} from '../LogoV2/ActivityClawd.js'
import { useAppState } from '../../state/AppState.js'
const MAX_IN_PROGRESS = 1
const MAX_RESPONSE_PREVIEW = 520
const THINKING_ANIM_FRAMES = ['○', '◦', '·', '◦']

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

export function shouldShowBlinkGenericStatus(options: {
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
export function isBlinkStreamingPreviewDuplicate(
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
      const parsed = parseLooseToolArguments(raw)
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

function truncatePreview(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  const truncated = oneLine.slice(0, max - 1)
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > max * 0.6
    ? `${truncated.slice(0, lastSpace)}...`
    : `${truncated}...`
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
export function BlinkLiveActivity({
  messages,
  inProgressToolUseIDs,
  isLoading,
  isProcessing = false,
  suppressIdleStatus = false,
  loadingStartTimeRef,
  epilogue,
  thoughtDurationMs,
  showThought = false,
  streamMode = 'responding',
  streamingToolUses = [],
  responseLengthRef,
  thinkingPreview,
  streamingTextPreview,
  statusOverride,
  activeToolCount = 0,
  showSpinner = false,
  turnFootnote,
  permissionMode: permissionModeProp,
}: Props): ReactNode {
  const permissionModeFromState = useAppState(
    s => s.toolPermissionContext.mode,
  )
  const permissionMode = permissionModeProp ?? permissionModeFromState
  const [elapsedMs, setElapsedMs] = useState(0)
  const [tokenEstimate, setTokenEstimate] = useState(0)
  const [sessionVerb, setSessionVerb] = useState<string | null>(null)
  const [thinkAnimFrame, setThinkAnimFrame] = useState(0)
  const messageCount = messages.length

  useEffect(() => {
    if (isLoading) {
      // Silly verbs only when accurate spinner is opted out (BLINK_ACCURATE_SPINNER=0).
      if (!isBlinkAccurateSpinnerEnabled()) {
        setSessionVerb(prev => prev ?? pickSpinnerVerb())
      }
      return
    }
    setSessionVerb(null)
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
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [isLoading, loadingStartTimeRef])

  useEffect(() => {
    if (!isLoading) {
      setTokenEstimate(getBlinkSessionTokenTotal())
      return
    }
    const tick = () => {
      setTokenEstimate(getBlinkLiveTokenEstimate(messages, responseLengthRef))
    }
    tick()
    const id = setInterval(tick, 400)
    return () => clearInterval(id)
  }, [isLoading, responseLengthRef, messageCount, messages])

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
    if (!isBlinkRuntime()) return null
    const streamText = streamingTextPreview?.trim() ?? ''
    if (!streamText) return null
    // Tool-shaped leaks render as tool rows, not prose.
    if (streamingToolLine(streamText)) return null
    const prose = filterBlinkStreamingPreview(streamText)
    if (!prose) return null
    const committed = lastBlinkCommittedAssistantDisplayText(messages)
    if (isBlinkStreamingPreviewDuplicate(prose, committed)) return null
    return truncatePreview(prose, MAX_RESPONSE_PREVIEW)
  }, [messages, streamPreviewKey, streamingTextPreview])

  const rows = useMemo((): ActivityRow[] => {
    if (!isBlinkRuntime()) return []

    const out: ActivityRow[] = []
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
    const overflow = Math.max(0, merged.length - MAX_IN_PROGRESS)
    for (const tool of merged.slice(-MAX_IN_PROGRESS)) {
      out.push({
        key: tool.id,
        line: formatOpenCodeToolLine(tool.name, tool.input, {
          inProgress: true,
        }),
      })
    }
    if (overflow > 0) {
      out.push({
        key: 'tool-overflow',
        line: {
          prefix: '+',
          text: `${overflow} more tool${overflow === 1 ? '' : 's'}`,
          color: 'subtle' as const,
          inProgress: true,
        },
      })
    }

    if (isProcessing && !isLoading && !suppressIdleStatus && out.length === 0) {
      out.push({
        key: 'sending',
        spinnerStatus: { label: 'Sending' },
      })
    }

    if (
      shouldShowBlinkGenericStatus({
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
          : formatBlinkLiveStatusLabel({
              streamMode,
              elapsedMs,
              tokenEstimate,
              spinnerVerb: sessionVerb ?? undefined,
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
    tokenEstimate,
    statusOverride,
    activeToolCount,
    sessionVerb,
    showThought,
    showSpinner,
    responseStreamPreview,
  ])

  // Tool rows (not the generic status) suppress thinking/response snippets.
  const hasToolRows = rows.some(r => r.line != null)

  const thoughtLine =
    showThought &&
    isBlinkRuntime() &&
    !hasToolRows &&
    !thinkingPreview?.trim() &&
    !responseStreamPreview
      ? formatOpenCodeThoughtLine(
          thoughtDurationMs,
          thoughtDurationMs == null,
        )
      : !isBlinkRuntime() && showThought && !hasToolRows
        ? formatOpenCodeThoughtLine(
            thoughtDurationMs,
            thoughtDurationMs == null,
          )
        : null

  const thinkingSnippet =
    thinkingPreview?.trim() && showThought && !hasToolRows
      ? thinkingPreview.trim()
      : null

  const isThinkingInProgress = showThought && thoughtDurationMs == null
  const isResponseStreaming = !!responseStreamPreview && isLoading

  useEffect(() => {
    if (!(isThinkingInProgress || isResponseStreaming)) {
      setThinkAnimFrame(0)
      return
    }
    const id = setInterval(() => {
      setThinkAnimFrame(f => (f + 1) % THINKING_ANIM_FRAMES.length)
    }, 220)
    return () => clearInterval(id)
  }, [isThinkingInProgress, isResponseStreaming])

  const showBuddy = false

  // Must run unconditionally (hooks) — collect before any early return.
  const activeToolNames = useMemo(() => {
    const names: string[] = []
    for (const stu of streamingToolUses) {
      if (stu.contentBlock.name) names.push(stu.contentBlock.name)
    }
    for (const tool of collectInProgressTools(messages, inProgressToolUseIDs)) {
      names.push(tool.name)
    }
    return names
  }, [streamingToolUses, messages, inProgressKey, inProgressToolUseIDs])

  const buddyMood = resolveClawdMood({
    isWorking: showBuddy,
    permissionMode,
    activeToolNames,
  })

  const hasLiveContent =
    rows.length > 0 ||
    !!epilogue ||
    !!thoughtLine ||
    !!thinkingSnippet ||
    !!responseStreamPreview ||
    isLoading ||
    isProcessing ||
    showSpinner ||
    !!turnFootnote?.trim()

  if (!hasLiveContent) {
    return null
  }

  const statusRows = rows.filter(r => r.spinnerStatus)
  const toolRows = rows.filter(r => r.line)
  const firstStatus = statusRows[0]
  const restStatus = statusRows.slice(1)

  return (
    <Box flexDirection="column" marginTop={0} marginBottom={0} paddingX={0}>
      {showBuddy || firstStatus ? (
        <Box
          flexDirection="row"
          marginBottom={0}
          paddingX={1}
          gap={1}
          alignItems="flex-end"
        >
          {showBuddy ? (
            <ActivityClawd isActive mood={buddyMood} inline={false} />
          ) : null}
          {firstStatus ? (
            <Box flexGrow={1} flexDirection="column" justifyContent="flex-end">
              <BlinkSpinnerStatusRow
                label={firstStatus.spinnerStatus!.label}
                mode={streamMode}
                responseLengthRef={responseLengthRef}
                hasActiveTools={activeToolCount > 0}
                hideGlyph={showBuddy}
              />
            </Box>
          ) : null}
        </Box>
      ) : null}
      {thoughtLine ? (
        <BlinkTreeRow>
          <Text>
            <Text color={thoughtLine.color} bold={thoughtLine.inProgress}>
              {thoughtLine.prefix}
            </Text>
            <Text> </Text>
            <Text
              color={thoughtLine.inProgress ? 'blinkPrimary' : thoughtLine.color}
              dimColor={!thoughtLine.inProgress}
              bold={thoughtLine.inProgress}
            >
              {thoughtLine.text}
            </Text>
            {thoughtLine.inProgress ? (
              <Text color="blinkPrimary" dimColor bold>{' ...'}</Text>
            ) : null}
          </Text>
        </BlinkTreeRow>
      ) : null}
      {thinkingSnippet ? (
        <BlinkTreeRow nested={!isBlinkRuntime()}>
          <Text>
            {isBlinkRuntime() ? (
              <Text color={isThinkingInProgress ? 'blinkPrimary' : 'subtle'} bold={isThinkingInProgress}>
                {isThinkingInProgress ? '> ' : '· '}
              </Text>
            ) : isThinkingInProgress ? (
              <Text color="warning">
                {THINKING_ANIM_FRAMES[thinkAnimFrame]}{' '}
              </Text>
            ) : (
              <Text dimColor color="subtle">
                ·{' '}
              </Text>
            )}
            <Text
              color={isThinkingInProgress ? 'text' : 'subtle'}
              dimColor={!isThinkingInProgress}
              italic={isThinkingInProgress}
            >
              {thinkingSnippet}
            </Text>
            {isThinkingInProgress ? (
              <Text color="blinkPrimary" dimColor bold>
                {' ...'}
              </Text>
            ) : null}
          </Text>
        </BlinkTreeRow>
      ) : null}
      {responseStreamPreview && !thinkingSnippet ? (
        <BlinkTreeRow>
          <Text>
            <Text color="blinkPrimary" bold={isResponseStreaming}>
              {isResponseStreaming
                ? `${THINKING_ANIM_FRAMES[thinkAnimFrame]} `
                : '> '}
            </Text>
            <Text
              color={isResponseStreaming ? 'text' : 'subtle'}
              dimColor={!isResponseStreaming}
              italic={isResponseStreaming}
            >
              {responseStreamPreview}
            </Text>
            {isResponseStreaming ? (
              <Text color="blinkPrimary" dimColor bold>
                {' ...'}
              </Text>
            ) : null}
          </Text>
        </BlinkTreeRow>
      ) : null}
      {toolRows.map(row =>
        row.line ? (
          <BlinkTreeRow key={row.key} nested={row.nested}>
            <Text>
              <Text color={row.line.color} bold={row.line.inProgress}>
                {row.line.prefix}
              </Text>
              <Text> </Text>
              <Text
                color={row.line.inProgress ? 'blinkPrimary' : row.line.color}
                dimColor={!row.line.inProgress && row.line.color === 'text'}
                bold={row.line.inProgress}
              >
                {row.line.text}
              </Text>
            </Text>
          </BlinkTreeRow>
        ) : null,
      )}
      {restStatus.map(row =>
        row.spinnerStatus ? (
          <BlinkTreeRow key={row.key} nested={row.nested}>
            <BlinkSpinnerStatusRow
              label={row.spinnerStatus.label}
              mode={streamMode}
              responseLengthRef={responseLengthRef}
              hasActiveTools={activeToolCount > 0}
            />
          </BlinkTreeRow>
        ) : null,
      )}
      {epilogue ? (
        <Box flexDirection="row" marginTop={0} paddingX={1}>
          <Text color="blinkPrimary" dimColor bold>
            <Text color="blinkPrimary">{'| '}</Text>{epilogue}
          </Text>
        </Box>
      ) : null}
      {turnFootnote ? (
        <BlinkTreeRow>
          <Text dimColor color="subtle">
            <Text color="blinkPrimary" bold>{'| '}</Text>
            {turnFootnote}
          </Text>
        </BlinkTreeRow>
      ) : null}
    </Box>
  )
}

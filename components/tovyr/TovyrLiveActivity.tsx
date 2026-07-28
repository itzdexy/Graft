import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react'
import { Box, Text } from '../../ink.js'
import type { Message } from '../../types/message.js'
import type { StreamingToolUse } from '../../utils/messages.js'
import { parseLooseToolArguments } from '../../services/tovyr/openaiCompat/toolNormalization.js'
import type { SpinnerMode } from '../Spinner.js'
import {
  formatOpenCodeToolLine,
  formatOpenCodeThoughtLine,
  formatTovyrLiveStatusLabel,
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
import { TovyrSpinnerStatusRow } from './TovyrSpinnerStatusRow.js'
import { TovyrTreeRow } from './TovyrTreeRow.js'
import {
  ActivityClawd,
  resolveClawdMood,
} from '../LogoV2/ActivityClawd.js'
import { useAppState } from '../../state/AppState.js'
const MAX_IN_PROGRESS = 1
const MAX_RESPONSE_PREVIEW = 520
const MAX_STREAMING_TOOL_INPUT = 16 * 1024
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
  permissionPending = false,
}: Props): ReactNode {
  const permissionModeFromState = useAppState(
    s => s.toolPermissionContext.mode,
  )
  const permissionMode = permissionModeProp ?? permissionModeFromState
  const [elapsedMs, setElapsedMs] = useState(0)
  const [sessionVerb, setSessionVerb] = useState<string | null>(null)
  const [thinkAnimFrame, setThinkAnimFrame] = useState(0)
  const messageCount = messages.length

  useEffect(() => {
    if (isLoading) {
      // Silly verbs only when accurate spinner is opted out (TOVYR_ACCURATE_SPINNER=0).
      if (!isTovyrAccurateSpinnerEnabled()) {
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
  ])

  // Tool rows (not the generic status) suppress thinking/response snippets.
  const hasToolRows = rows.some(r => r.line != null)

  const thoughtLine =
    showThought &&
    isTovyrRuntime() &&
    !hasToolRows &&
    !thinkingPreview?.trim() &&
    !responseStreamPreview
      ? formatOpenCodeThoughtLine(
          thoughtDurationMs,
          thoughtDurationMs == null,
        )
      : !isTovyrRuntime() && showThought && !hasToolRows
        ? formatOpenCodeThoughtLine(
            thoughtDurationMs,
            thoughtDurationMs == null,
          )
        : null

  const thinkingSnippet =
    thinkingPreview?.trim() && showThought && !hasToolRows
      ? compactLivePreview(thinkingPreview, MAX_RESPONSE_PREVIEW)
      : null

  const isThinkingInProgress = showThought && thoughtDurationMs == null
  const isResponseStreaming = !!responseStreamPreview && isLoading
  const reducedMotion =
    useAppState(s => s.settings.prefersReducedMotion) ?? false

  useEffect(() => {
    if (
      reducedMotion ||
      !(isThinkingInProgress || isResponseStreaming)
    ) {
      setThinkAnimFrame(0)
      return
    }
    const id = setInterval(() => {
      setThinkAnimFrame(f => (f + 1) % THINKING_ANIM_FRAMES.length)
    }, 220)
    return () => clearInterval(id)
  }, [isThinkingInProgress, isResponseStreaming, reducedMotion])

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
    !!turnFootnote?.trim() ||
    permissionPending

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
              <TovyrSpinnerStatusRow
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
        <TovyrTreeRow>
          <Text>
            <Text color={thoughtLine.color} bold={thoughtLine.inProgress}>
              {thoughtLine.prefix}
            </Text>
            <Text> </Text>
            <Text
              color={thoughtLine.inProgress ? 'tovyrPrimary' : thoughtLine.color}
              dimColor={!thoughtLine.inProgress}
              bold={thoughtLine.inProgress}
            >
              {thoughtLine.text}
            </Text>
            {thoughtLine.inProgress ? (
              <Text color="tovyrPrimary" dimColor bold>{' ...'}</Text>
            ) : null}
          </Text>
        </TovyrTreeRow>
      ) : null}
      {thinkingSnippet ? (
        <TovyrTreeRow nested={!isTovyrRuntime()}>
          <Text>
            {isTovyrRuntime() ? (
              <Text color={isThinkingInProgress ? 'tovyrPrimary' : 'subtle'} bold={isThinkingInProgress}>
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
              <Text color="tovyrPrimary" dimColor bold>
                {' ...'}
              </Text>
            ) : null}
          </Text>
        </TovyrTreeRow>
      ) : null}
      {responseStreamPreview && !thinkingSnippet ? (
        <TovyrTreeRow>
          <Text>
            <Text color="tovyrPrimary" bold={isResponseStreaming}>
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
              <Text color="tovyrPrimary" dimColor bold>
                {' ...'}
              </Text>
            ) : null}
          </Text>
        </TovyrTreeRow>
      ) : null}
      {toolRows.map(row =>
        row.line ? (
          <TovyrTreeRow key={row.key} nested={row.nested}>
            <Text>
              <Text color={row.line.color} bold={row.line.inProgress}>
                {row.line.prefix}
              </Text>
              <Text> </Text>
              <Text
                color={row.line.inProgress ? 'tovyrPrimary' : row.line.color}
                dimColor={!row.line.inProgress && row.line.color === 'text'}
                bold={row.line.inProgress}
              >
                {row.line.text}
              </Text>
            </Text>
          </TovyrTreeRow>
        ) : null,
      )}
      {restStatus.map(row =>
        row.spinnerStatus ? (
          <TovyrTreeRow key={row.key} nested={row.nested}>
            <TovyrSpinnerStatusRow
              label={row.spinnerStatus.label}
              mode={streamMode}
              responseLengthRef={responseLengthRef}
              hasActiveTools={activeToolCount > 0}
            />
          </TovyrTreeRow>
        ) : null,
      )}
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

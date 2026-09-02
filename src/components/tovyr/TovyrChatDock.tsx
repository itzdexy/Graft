import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Box } from '../../ink.js'
import type { StreamingThinking, StreamingToolUse } from '../../utils/messages.js'
import type { Message } from '../../types/message.js'
import type { Theme } from '../../utils/theme.js'
import { getContentText } from '../../utils/messages.js'
import { isHumanTurn } from '../../utils/messagePredicates.js'
import { pauseAgentSessionIfCasual } from '../../services/tovyr/agent/autoBootstrap.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import { TovyrUserTextMessage } from './TovyrUserTextMessage.js'
import { TovyrLiveActivity } from './TovyrLiveActivity.js'
import type { SpinnerMode } from '../Spinner.js'
import { useSettings } from '../../hooks/useSettings.js'
import { loadAgentSession } from '../../services/tovyr/agent/persistence.js'
import { getCwd } from '../../utils/cwd.js'
import {
  isAgentSessionPromptRelevant,
  selectVisibleOrchestration,
} from '../../services/tovyr/dx/orchestrationVisibility.js'
import { useInterval } from '../../ink/hooks/use-interval.js'
import { MOTION_STATUS_MS } from '../motion/motionConfig.js'

type Props = {
  messages: Message[]
  pendingText?: string
  isLoading: boolean
  isProcessing?: boolean
  inProgressToolUseIDs: Set<string>
  showSpinner: boolean
  streamMode: SpinnerMode
  spinnerTip?: string
  spinnerMessage?: string | null
  spinnerSuffix?: string | null
  verbose: boolean
  loadingStartTimeRef: RefObject<number>
  totalPausedMsRef: RefObject<number>
  pauseStartTimeRef: RefObject<number | null>
  responseLengthRef: RefObject<number>
  spinnerColor?: keyof Theme | null
  spinnerShimmerColor?: keyof Theme | null
  suppressIdleStatus?: boolean
  modelName?: string
  permissionMode?: string
  permissionPending?: boolean
  streamingToolUses?: StreamingToolUse[]
  streamingThinking?: StreamingThinking | null
  streamingTextPreview?: string | null
  turnFootnote?: string | null
}

function lastUserPrompt(messages: Message[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!msg || !isHumanTurn(msg)) continue
    const content = msg.message.content
    if (typeof content === 'string' && content.trim()) return content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text' && block.text.trim()) return block.text
      }
    }
  }
  return undefined
}

function userLineInTranscript(messages: Message[], text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!msg || !isHumanTurn(msg)) continue
    const line = getContentText(msg.message.content)?.trim()
    return line === trimmed
  }
  return false
}

/** Pinned above the prompt — live turn activity only (OpenCode-style). */
export function TovyrChatDock({
  messages,
  pendingText,
  isLoading,
  isProcessing,
  inProgressToolUseIDs,
  showSpinner,
  streamMode,
  spinnerTip,
  spinnerMessage,
  spinnerSuffix,
  verbose,
  loadingStartTimeRef,
  totalPausedMsRef,
  pauseStartTimeRef,
  responseLengthRef,
  spinnerColor,
  spinnerShimmerColor,
  suppressIdleStatus = false,
  modelName,
  permissionMode,
  permissionPending = false,
  streamingToolUses = [],
  streamingThinking,
  streamingTextPreview,
  turnFootnote,
}: Props): ReactNode {
  const reasoningDisplay = useSettings().reasoningDisplay ?? 'live-collapse'
  const [thoughtDurationMs, setThoughtDurationMs] = useState<number | undefined>()
  const [showCompletedThought, setShowCompletedThought] = useState(false)
  const [thinkingElapsedMs, setThinkingElapsedMs] = useState(0)
  const thoughtStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (streamMode === 'thinking') {
      if (thoughtStartRef.current === null) {
        thoughtStartRef.current = Date.now()
      }
      setShowCompletedThought(false)
      return
    }
    if (thoughtStartRef.current !== null) {
      const duration = Date.now() - thoughtStartRef.current
      thoughtStartRef.current = null
      setThoughtDurationMs(duration)
      setShowCompletedThought(true)
    }
  }, [streamMode])

  useEffect(() => {
    if (!showCompletedThought) return
    const timer = setTimeout(() => {
      setShowCompletedThought(false)
      setThoughtDurationMs(undefined)
    }, 30_000)
    return () => clearTimeout(timer)
  }, [showCompletedThought, thoughtDurationMs])

  useEffect(() => {
    if (streamMode !== 'thinking' || thoughtStartRef.current === null) {
      setThinkingElapsedMs(0)
      return
    }
    const tick = () => {
      const start = thoughtStartRef.current
      if (!start) return
      setThinkingElapsedMs(Math.max(0, Date.now() - start))
    }
    tick()
  }, [streamMode])

  // Shared clock: the elapsed readout is status, so it keeps its cadence even
  // when decorative motion is off.
  useInterval(
    () => {
      const start = thoughtStartRef.current
      if (!start) return
      setThinkingElapsedMs(Math.max(0, Date.now() - start))
    },
    thoughtStartRef.current ? MOTION_STATUS_MS : null,
  )

  const echoed = useMemo(() => {
    const pending = pendingText?.trim()
    if (pending) {
      return userLineInTranscript(messages, pending) ? undefined : pending
    }
    const last = lastUserPrompt(messages)
    if (!last?.trim()) return undefined
    return userLineInTranscript(messages, last) ? undefined : last
  }, [messages, pendingText])

  const busy = isLoading || !!isProcessing
  const lastPrompt = lastUserPrompt(messages)
  const cwd = getCwd()
  // Refresh at turn/lifecycle boundaries, not for each streaming preview chunk.
  const persistedSession = useMemo(
    () => loadAgentSession(cwd),
    [cwd, lastPrompt, messages.length, busy],
  )
  const promptRelevant =
    !lastPrompt || isAgentSessionPromptRelevant(persistedSession, lastPrompt)
  const orchestration = selectVisibleOrchestration(
    persistedSession,
    promptRelevant,
  )
  const hasToolActivity =
    inProgressToolUseIDs.size > 0 || streamingToolUses.length > 0
  const hasThinkingText = !!streamingThinking?.thinking?.trim()
  const showThought =
    reasoningDisplay !== 'hidden' &&
    (streamMode === 'thinking' ||
      (showCompletedThought && thoughtDurationMs != null) ||
      (hasThinkingText && busy))
  const liveThoughtMs =
    streamMode === 'thinking' ? thinkingElapsedMs : thoughtDurationMs
  const thinkingPreviewBudget = hasToolActivity ? 2048 : 4096
  const thinkingPreview =
    reasoningDisplay === 'live-collapse' &&
    streamMode === 'thinking' &&
    hasThinkingText
      ? streamingThinking!.thinking.slice(-thinkingPreviewBudget)
      : reasoningDisplay === 'summary' && hasThinkingText
        ? (() => {
            const snippet = streamingThinking!.thinking.trim().slice(-160)
            const secs =
              liveThoughtMs != null
                ? Math.max(1, Math.round(liveThoughtMs / 1000))
                : null
            const head = secs != null ? `Thought ${secs}s` : 'Thought'
            return snippet ? `${head} · ${snippet}` : head
          })()
        : null

  const hasLiveFeed =
    busy ||
    showSpinner ||
    hasToolActivity ||
    hasThinkingText ||
    permissionPending

  // Pause agent missions on casual chat — keep the dock to one live activity row.
  useEffect(() => {
    if (!isTovyrRuntime() || !lastPrompt || busy) return
    pauseAgentSessionIfCasual(lastPrompt)
  }, [lastPrompt, busy])

  if (
    !echoed &&
    !hasLiveFeed &&
    !showThought &&
    !showSpinner &&
    !turnFootnote?.trim()
  ) {
    return null
  }

  return (
    <Box flexDirection="column" width="100%" marginBottom={0} paddingX={1}>
      {echoed ? (
        <TovyrUserTextMessage text={echoed} addMargin={false} />
      ) : null}
      {hasLiveFeed ? (
        <Box
          borderStyle="single"
          borderColor="subtle"
          borderDimColor
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          marginTop={0}
          marginBottom={0}
        />
      ) : null}
      <TovyrLiveActivity
        messages={messages}
        inProgressToolUseIDs={inProgressToolUseIDs}
        isLoading={isLoading}
        isProcessing={isProcessing}
        suppressIdleStatus={suppressIdleStatus}
        loadingStartTimeRef={loadingStartTimeRef}
        showThought={showThought}
        thoughtDurationMs={liveThoughtMs}
        streamMode={streamMode}
        streamingToolUses={streamingToolUses}
        responseLengthRef={responseLengthRef}
        thinkingPreview={thinkingPreview}
        streamingTextPreview={streamingTextPreview}
        statusOverride={spinnerMessage}
        activeToolCount={inProgressToolUseIDs.size}
        showSpinner={showSpinner}
        turnFootnote={turnFootnote}
        permissionMode={permissionMode}
        permissionPending={permissionPending}
        orchestrationState={orchestration?.state}
      />
    </Box>
  )
}

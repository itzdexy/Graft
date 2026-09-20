import type { ThinkingBlock, ThinkingBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import React from 'react'
import { Box, Text, useAnimationFrame } from '../../ink.js'
import { CtrlOToExpand } from '../CtrlOToExpand.js'
import { Markdown } from '../Markdown.js'
import { useSettings } from '../../hooks/useSettings.js'
import {
  formatThinkingHeader,
  summarizeThinkingGist,
  summarizeLiveThinking,
} from '../../services/graft/dx/thinkingHeader.js'
import { lookupThinkingDuration } from '../../services/graft/dx/thinkingDurations.js'

/**
 * Reasoning is secondary to the answer, so it reads in the warning hue rather
 * than the primary accent — present, clearly not the result.
 */
const THINKING_ACCENT = 'subtle' as const

type Props = {
  param:
    | ThinkingBlock
    | ThinkingBlockParam
    | { type: 'thinking'; thinking: string }
  addMargin?: boolean
  isTranscriptMode: boolean
  verbose: boolean
  hideInTranscript?: boolean
  /** Wall-clock start, used for the live elapsed counter. */
  thinkingStartedAt?: number
  /** Drives the animated header; finished blocks render a static rule. */
  isStreaming?: boolean
}

/** Filled-arc cycle reads as continuous motion at 8 fps without strobing. */
const THINKING_FRAMES = ['◐', '◓', '◑', '◒'] as const
const FRAME_MS = 120


function ThinkingIndicator({
  startedAt,
}: {
  startedAt?: number
}): React.ReactNode {
  const reducedMotion = useSettings().prefersReducedMotion ?? false
  const [ref, time] = useAnimationFrame(reducedMotion ? 1000 : FRAME_MS)
  const frame = reducedMotion ? 0 : Math.floor(time / FRAME_MS) % THINKING_FRAMES.length
  const elapsedSec = startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : 0
  const elapsedLabel = elapsedSec < 60
    ? `${Math.floor(elapsedSec)}s`
    : `${Math.floor(elapsedSec / 60)}m ${String(Math.floor(elapsedSec % 60)).padStart(2, '0')}s`

  return (
    <Box ref={ref} flexDirection="row" alignItems="center" gap={1}>
      <Text color={THINKING_ACCENT}>{THINKING_FRAMES[frame]}</Text>
      <Text color={THINKING_ACCENT}>Thinking</Text>
      {elapsedSec > 0 ? <Text dimColor>{elapsedLabel}</Text> : null}
    </Box>
  )
}

function AssistantThinkingMessageImpl({
  param,
  addMargin = false,
  isTranscriptMode,
  verbose,
  hideInTranscript = false,
  thinkingStartedAt,
  isStreaming = false,
}: Props): React.ReactNode {
  // Declared before the empty-reasoning guard below: an early return that
  // skips a hook changes the hook order between renders.
  const [isOpen, setIsOpen] = React.useState(false)

  const { thinking } = param
  // A model that emits an empty or whitespace-only reasoning field would
  // otherwise leave a `+ Thought` row that expands into nothing.
  if (!thinking?.trim() || hideInTranscript) return null

  const elapsedMs = (): number | undefined => {
    if (thinkingStartedAt) return Date.now() - thinkingStartedAt
    // Past turns carry no start time; the stream recorded the duration by
    // content as the block closed.
    return lookupThinkingDuration(thinking)
  }

  // Transcript and verbose mode force the block open; otherwise the row owns
  // its own state so a single thought can be opened without switching the
  // whole transcript into another mode.
  const open = isTranscriptMode || verbose || isOpen
  const header = formatThinkingHeader({
    state: isStreaming ? 'streaming' : open ? 'expanded' : 'collapsed',
    elapsedMs: elapsedMs(),
  })
  // A bare `+ Thought` row gave the reader nothing: it announced that
  // reasoning happened and withheld all of it, and the ctrl+o hint is
  // suppressed inside the virtual list. Carrying one line of the reasoning
  // makes the closed row worth reading on its own.
  const gist = open ? '' : isStreaming ? summarizeLiveThinking(thinking) : summarizeThinkingGist(thinking)

  return (
    <Box flexDirection="column" marginTop={addMargin ? 1 : 0} width="100%">
      {isStreaming ? (
        <ThinkingIndicator startedAt={thinkingStartedAt} />
      ) : (
        <Box
          flexDirection="row"
          alignItems="center"
          gap={1}
          onClick={() => setIsOpen(current => !current)}
        >
          <Text color={THINKING_ACCENT}>{header.marker}</Text>
          <Text color={THINKING_ACCENT}>{header.label}</Text>
          {/* The hint reads "to expand", so it only belongs on a closed row.
              On an open one the `-` marker already offers the collapse. */}
          {open ? null : <CtrlOToExpand />}
        </Box>
      )}
      {gist ? (
        <Box paddingLeft={2}>
          <Text color="subtle" dimColor wrap="truncate-end">
            {gist}
          </Text>
        </Box>
      ) : null}
      {open ? (
        <Box paddingLeft={2} marginTop={1} flexDirection="column">
          <Markdown dimColor={true}>{thinking}</Markdown>
        </Box>
      ) : null}
    </Box>
  )
}

/**
 * Thinking blocks re-render on every stream delta; memoizing on the props that
 * actually change keeps the transcript off the per-delta repaint path.
 */
export const AssistantThinkingMessage = React.memo(AssistantThinkingMessageImpl)

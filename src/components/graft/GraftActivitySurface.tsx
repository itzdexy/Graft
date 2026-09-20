import { useEffect, useState, type ReactNode } from 'react'
import { useInterval } from '../../ink/hooks/use-interval.js'
import {
  MOTION_FRAME_MS,
  motionInterval,
  isMotionEnabled,
} from '../motion/motionConfig.js'
import { Box, Text } from '../../ink.js'
import type { GraftTurnActivity } from '../../services/graft/dx/turnActivity.js'
import { useAppState } from '../../state/AppState.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { truncateToWidth } from '../../utils/format.js'
import { sourceBadge } from '../../services/graft/dx/browserSources.js'

const ACTIVITY_COPY_CHROME_WIDTH = 4 // horizontal padding + one-cell signal + gap
const DETAIL_SEPARATOR = ' · '

/**
 * Rotating braille reads as one turning circle; the wave is reserved for
 * streaming, where rising/falling bars actually mean "tokens are arriving".
 * Every frame must stay a single terminal cell or the copy beside it jitters.
 */
const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧'] as const
const WAVE_FRAMES = ['▁', '▃', '▅', '▆', '▅', '▃'] as const

const MOTION_FRAMES: Partial<Record<GraftTurnActivity['kind'], string[]>> = {
  ideating: [...SPIN_FRAMES],
  planning: [...SPIN_FRAMES],
  thinking: [...SPIN_FRAMES],
  searching: [...SPIN_FRAMES],
  reading_source: [...SPIN_FRAMES],
  coding: [...SPIN_FRAMES],
  running_tool: [...SPIN_FRAMES],
  streaming: [...WAVE_FRAMES],
  handoff: [...SPIN_FRAMES],
  verifying: [...SPIN_FRAMES],
  recovering: [...SPIN_FRAMES],
}

/**
 * Category glyph. These replaced an ASCII set (`$`, `+`, `=`, `v`, `x`) that
 * collided with the motion frame beside it — streaming rendered as the literal
 * digraph "=~", which read as mojibake rather than as an icon.
 */
const ACTIVITY_ICON: Record<GraftTurnActivity['kind'], string> = {
  ideating: '✦',
  planning: '◇',
  // `∴` read as an inverted cross at terminal size; `◐` matches the thinking
  // animation frames used by AssistantThinkingMessage.
  thinking: '◐',
  searching: '⌕',
  reading_source: '▫',
  coding: '✎',
  running_tool: '▸',
  streaming: '▪',
  waiting_for_permission: '⚠',
  handoff: '→',
  verifying: '✓',
  recovering: '↻',
  failed: '✗',
  complete: '✓',
}

/**
 * Still states show the icon alone. The old dash placeholder turned every
 * paused row into a two-glyph digraph ("✎-"), which reads as punctuation.
 */
const STATIC_MARKER: Record<GraftTurnActivity['kind'], string> = {
  ideating: ' ',
  planning: ' ',
  thinking: ' ',
  searching: ' ',
  reading_source: ' ',
  coding: ' ',
  running_tool: ' ',
  streaming: ' ',
  waiting_for_permission: ' ',
  handoff: ' ',
  verifying: ' ',
  recovering: ' ',
  failed: ' ',
  complete: ' ',
}

type SurfaceColor = 'graftPrimary' | 'warning' | 'error' | 'success'

export function projectActivitySurface(
  activity: GraftTurnActivity,
  frame: number,
  reducedMotion: boolean,
  maxCopyWidth?: number,
): {
  marker: string
  icon: string
  label: string
  detail: string | undefined
  color: SurfaceColor
  animate: boolean
} {
  const frames = MOTION_FRAMES[activity.kind]
  const animate =
    !reducedMotion &&
    activity.status === 'active' &&
    Array.isArray(frames) &&
    frames.length > 0
  const color: SurfaceColor =
    activity.status === 'failed'
      ? 'error'
      : activity.status === 'complete'
        ? 'success'
        : activity.kind === 'waiting_for_permission'
          ? 'warning'
          : 'graftPrimary'
  const label = activity.label.replace(/\s+/g, ' ').trim()
  const detail = activity.detail?.replace(/\s+/g, ' ').trim() || undefined
  const fitted = fitActivityCopy(label, detail, maxCopyWidth)
  return {
    icon: ACTIVITY_ICON[activity.kind],
    marker: animate
      ? frames[frame % frames.length]!
      : STATIC_MARKER[activity.kind],
    label: fitted.label,
    detail: fitted.detail,
    color,
    animate,
  }
}

function fitActivityCopy(
  label: string,
  detail: string | undefined,
  maxWidth: number | undefined,
): { label: string; detail: string | undefined } {
  if (maxWidth == null) return { label, detail }

  const width = Math.max(1, Math.floor(maxWidth))
  const labelWidth = stringWidth(label)
  if (!detail) {
    return { label: truncateToWidth(label, width), detail: undefined }
  }
  if (
    labelWidth + stringWidth(DETAIL_SEPARATOR) + stringWidth(detail) <= width
  ) {
    return { label, detail }
  }
  if (labelWidth >= width) {
    return { label: truncateToWidth(label, width), detail: undefined }
  }

  const detailWidth = width - labelWidth - stringWidth(DETAIL_SEPARATOR)
  if (detailWidth <= 0) return { label, detail: undefined }
  return {
    label,
    detail: truncateToWidth(detail, detailWidth),
  }
}

export function GraftActivitySurface({
  activity,
  reducedMotion: reducedMotionOverride,
}: {
  activity: GraftTurnActivity
  reducedMotion?: boolean
}): ReactNode {
  const configuredReducedMotion =
    useAppState(state => state.settings.prefersReducedMotion) ?? false
  const reducedMotion = (reducedMotionOverride ?? configuredReducedMotion) || !isMotionEnabled()
  const { columns } = useTerminalSize()
  const [frame, setFrame] = useState(0)
  const hosts = activity.sourceHosts ?? []
  const webActivity = ['searching', 'reading_source', 'verifying'].includes(activity.kind)
  const badgeHosts = columns >= 48 ? hosts.slice(-3) : []
  const currentHost = hosts.length ? hosts[Math.floor(frame / 5) % hosts.length] : undefined
  const projection = projectActivitySurface(
    activity,
    frame,
    reducedMotion,
    Math.max(1, columns - ACTIVITY_COPY_CHROME_WIDTH - badgeHosts.length * 4),
  )

  useEffect(() => {
    setFrame(0)
  }, [activity.kind])

  // On the shared clock rather than a private setInterval: one timer drives
  // every animated component, ticks are aligned so nothing tears against
  // anything else, and the whole thing stops when the terminal loses focus.
  // A null interval unsubscribes entirely, so motion-off costs nothing.
  useInterval(
    () => setFrame(value => value + 1),
    projection.animate ? motionInterval(MOTION_FRAME_MS) : null,
    true,
  )

  return (
    <Box
      flexDirection="row"
      width="100%"
      minWidth={0}
      height={1}
      flexShrink={1}
      overflow="hidden"
      paddingX={1}
    >
      <Box flexDirection="row" flexShrink={0}>
        <Text color={projection.color} bold>
          {/* One glyph, never two. Pairing the category icon with the motion
              frame produced digraphs like "∴⠹" that read as scattered dots
              rather than as a spinner. While active the spinner carries the
              row; at rest the category icon does. */}
          {projection.animate ? projection.marker : projection.icon}
        </Text>
        <Text> </Text>
      </Box>
      {webActivity && badgeHosts.length > 0 ? (
        <Box flexDirection="row" flexShrink={0} gap={1} paddingRight={1}>
          {badgeHosts.map(host => {
            const badge = sourceBadge(host)
            return <Text key={host} color={badge.color} inverse={host === currentHost} bold>{` ${badge.glyph} `}</Text>
          })}
        </Box>
      ) : null}
      <Box
        flexDirection="row"
        minWidth={0}
        height={1}
        flexGrow={1}
        flexShrink={1}
        overflow="hidden"
      >
        <Text
          wrap="truncate-end"
          color={
            activity.status === 'active' ? 'text' : projection.color
          }
          bold={activity.kind === 'waiting_for_permission'}
        >
          {webActivity && currentHost
            ? truncateToWidth(`${activity.kind === 'searching' ? 'Searching' : activity.kind === 'verifying' ? 'Testing' : 'Reading'} · ${currentHost}${hosts.length > 1 ? ` · ${hosts.length} sources` : ''}`, Math.max(1, columns - ACTIVITY_COPY_CHROME_WIDTH - badgeHosts.length * 4))
            : projection.label}
          {projection.detail ? (
            <Text color="subtle" dimColor>
              {DETAIL_SEPARATOR}
              {projection.detail}
            </Text>
          ) : null}
        </Text>
      </Box>
    </Box>
  )
}

import * as React from 'react'
import { Box, Text } from '../../ink.js'

export type GraftBuddyPose =
  | 'default'
  | 'arms-up'
  | 'look-left'
  | 'look-right'
  | 'graft'
  | 'talk'
  | 'talk-mid'
  | 'talk-open'
  | 'talk-wide'
  | 'think'
  | 'laptop'
  | 'laptop-type'
  | 'glasses'
  | 'research'
  | 'research-type'
  | 'happy'

type Props = {
  pose?: GraftBuddyPose
  /** Single-line face for /provider and /model headers. */
  inline?: boolean
  /** Minimal mark for dense dashboard headers. */
  compact?: boolean
}

/**
 * Classic Clawd silhouette (orange reference → blue via clawd_body):
 *   █████████     head
 *  ██▄█████▄██    eyes + side arm stubs
 *   █████████     body
 *  █ █     █ █    four stubby legs
 * Fixed width 11. One `<Text>` per row for Windows alignment.
 */
const HEAD = ' █████████ '
const FACE = '██▄█████▄██' // side ██ blocks = arms
const BODY = ' █████████ '
const LEGS = '█ █     █ █' // four toes

/** Exported for sprite regression tests. */
export const FRAMES: Record<GraftBuddyPose, string[]> = {
  default: [HEAD, FACE, BODY, LEGS],
  'arms-up': ['▄ ███████ ▄', FACE, BODY, LEGS],
  'look-left': [HEAD, '██▄███▄████', BODY, LEGS],
  'look-right': [HEAD, '████▄███▄██', BODY, LEGS],
  graft: [HEAD, '██───────██', BODY, LEGS],
  // Talk: mouth on the body row
  talk: [HEAD, FACE, ' ███─█─███ ', LEGS],
  'talk-mid': [HEAD, FACE, ' ███═█═███ ', LEGS],
  'talk-open': [HEAD, FACE, ' ███▄█▄███ ', LEGS],
  'talk-wide': [HEAD, FACE, ' ███▀█▀███ ', LEGS],
  think: [HEAD, FACE, ' ████░████ ', LEGS],
  happy: [HEAD, FACE, ' ███▀▀▀███ ', LEGS],
  // Coding — laptop in front
  laptop: [HEAD, FACE, ' ▐███████▌ ', '█ █▀▀▀▀▀█ █'],
  'laptop-type': [HEAD, FACE, ' ▐███▓███▌ ', '█ █▀▓▀▓▀█ █'],
  // Research — glasses, then glasses + laptop
  glasses: [HEAD, '██░█████░██', BODY, LEGS],
  research: [HEAD, '██░█████░██', ' ▐███████▌ ', '█ █▀▀▀▀▀█ █'],
  'research-type': [
    HEAD,
    '██░█████░██',
    ' ▐███▓███▌ ',
    '█ █▀▓▀▓▀█ █',
  ],
}

/** Inline single-line face (condensed header) — width 11. */
export const INLINE_FRAMES: Record<GraftBuddyPose, string> = {
  default: FACE,
  'arms-up': '▄█▄█████▄█▄',
  'look-left': '██▄███▄████',
  'look-right': '████▄███▄██',
  graft: '██───────██',
  talk: '██▄█─█─█▄██',
  'talk-mid': '██▄█═█═█▄██',
  'talk-open': '██▄█▄█▄█▄██',
  'talk-wide': '██▄█▀█▀█▄██',
  think: '██▄█████▄░█',
  happy: '██▄█▀▀▀█▄██',
  laptop: '█▐█████▌███',
  'laptop-type': '█▐██▓██▌███',
  glasses: '██░█████░██',
  research: '░▐█████▌███',
  'research-type': '░▐██▓██▌███',
}

function BuddyLine({
  line,
  eyes = false,
}: {
  line: string
  /** Eye row: black bg so ▄ slits read as eyes (classic Clawd). */
  eyes?: boolean
}) {
  if (eyes) {
    return (
      <Text color="clawd_body" backgroundColor="clawd_background">
        {line}
      </Text>
    )
  }
  return <Text color="clawd_body">{line}</Text>
}

export function GraftBuddy({
  pose = 'default',
  inline = false,
  compact = false,
}: Props): React.ReactNode {
  if (compact) {
    return (
      <Text color="clawd_body" bold>
        {'◆'}
      </Text>
    )
  }

  if (inline) {
    const inlineLine = INLINE_FRAMES[pose] ?? INLINE_FRAMES.default ?? FACE
    return (
      <Box flexDirection="column" alignItems="flex-start" flexShrink={0}>
        <BuddyLine line={inlineLine} eyes />
      </Box>
    )
  }

  const lines = FRAMES[pose] ?? FRAMES.default ?? [HEAD, FACE, BODY, LEGS]

  return (
    <Box
      flexDirection="column"
      alignItems="flex-start"
      flexShrink={0}
      marginY={0}
    >
      {lines.map((line, i) => (
        <BuddyLine key={i} line={line} eyes={i === 1} />
      ))}
    </Box>
  )
}

/** Drop-in alias for legacy Clawd imports */
export const Clawd = GraftBuddy
export type ClawdPose = GraftBuddyPose

/** Buddy sprite row count (head / face / body / legs). */
export const GRAFT_BUDDY_HEIGHT = 4

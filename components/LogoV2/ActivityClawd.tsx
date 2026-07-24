import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Box } from '../../ink.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import { AnimatedClawd } from './AnimatedClawd.js'
import { Clawd, BLINK_BUDDY_HEIGHT, type ClawdPose } from './Clawd.js'

const TALK_FRAME_MS = 160
const CODE_FRAME_MS = 340
const RESEARCH_FRAME_MS = 400
const IDLE_TICK_MS = 1000
const IDLE_HOLD_DEFAULT = 3

export type ClawdMood =
  | 'idle'
  | 'talking'
  | 'coding'
  | 'researching'
  | 'planning'
  | 'listening'

/** Mouth cycle while Blink is streaming a reply. */
const TALKING_POSES: readonly ClawdPose[] = [
  'talk',
  'talk-mid',
  'talk-open',
  'talk-wide',
  'talk-open',
  'talk-mid',
  'talk',
  'talk-open',
  'default',
]

/** Laptop typing loop. */
const CODING_POSES: readonly ClawdPose[] = [
  'laptop',
  'laptop-type',
  'laptop',
  'laptop-type',
  'laptop',
]

/** Glasses on → laptop out → type. */
const RESEARCHING_POSES: readonly ClawdPose[] = [
  'glasses',
  'glasses',
  'research',
  'research-type',
  'research',
  'research-type',
  'research',
]

/** Contemplative glance loop in /plan. */
const PLANNING_POSES: readonly ClawdPose[] = [
  'think',
  'think',
  'look-left',
  'think',
  'look-right',
  'default',
]

/** Soft listening fidget. */
const LISTENING_POSES: readonly ClawdPose[] = [
  'default',
  'default',
  'look-left',
  'default',
  'look-right',
  'blink',
  'default',
]

const IDLE_SEQUENCES: readonly (readonly ClawdPose[])[] = [
  ['default', 'blink', 'default'],
  ['default', 'look-left', 'look-left', 'default'],
  ['default', 'look-right', 'look-right', 'default'],
  ['default', 'arms-up', 'arms-up', 'default'],
  ['default', 'happy', 'default'],
  ['default', 'think', 'think', 'default'],
  ['default', 'look-left', 'look-right', 'default'],
]

type Props = {
  isActive?: boolean
  mood?: ClawdMood
  inline?: boolean
}

function posesForMood(mood: ClawdMood): readonly ClawdPose[] {
  switch (mood) {
    case 'talking':
      return TALKING_POSES
    case 'coding':
      return CODING_POSES
    case 'researching':
      return RESEARCHING_POSES
    case 'planning':
      return PLANNING_POSES
    case 'listening':
      return LISTENING_POSES
    case 'idle':
      return IDLE_SEQUENCES[0]!
    default: {
      const _exhaustive: never = mood
      return _exhaustive
    }
  }
}

function frameMsForMood(mood: ClawdMood): number {
  switch (mood) {
    case 'talking':
      return TALK_FRAME_MS
    case 'coding':
      return CODE_FRAME_MS
    case 'researching':
      return RESEARCH_FRAME_MS
    case 'planning':
      return 700
    case 'listening':
      return 1100
    case 'idle':
      return IDLE_TICK_MS
    default: {
      const _exhaustive: never = mood
      return _exhaustive
    }
  }
}

function buildIdleSequence(excludeIndex: number): {
  poses: readonly ClawdPose[]
  index: number
} {
  let index = Math.floor(Math.random() * IDLE_SEQUENCES.length)
  if (IDLE_SEQUENCES.length > 1 && index === excludeIndex) {
    index = (index + 1) % IDLE_SEQUENCES.length
  }
  const picked = IDLE_SEQUENCES[index]!
  return {
    index,
    poses: [
      ...Array.from({ length: IDLE_HOLD_DEFAULT }, () => 'default' as const),
      ...picked,
      ...Array.from({ length: IDLE_HOLD_DEFAULT }, () => 'default' as const),
    ],
  }
}

function reducedPoseForMood(mood: ClawdMood): ClawdPose {
  switch (mood) {
    case 'coding':
      return 'laptop'
    case 'researching':
      return 'research'
    case 'talking':
      return 'talk'
    case 'planning':
      return 'think'
    case 'listening':
    case 'idle':
      return 'default'
    default: {
      const _exhaustive: never = mood
      return _exhaustive
    }
  }
}

/**
 * Blink buddy with mood loops + random idle fidget. Honors reduced motion.
 */
export function ActivityClawd({
  isActive = false,
  mood: moodProp,
  inline = false,
}: Props): React.ReactNode {
  const [reducedMotion] = useState(
    () => getInitialSettings().prefersReducedMotion ?? false,
  )
  const mood: ClawdMood = moodProp ?? (isActive ? 'talking' : 'idle')

  const posesRef = useRef<readonly ClawdPose[]>(posesForMood(mood))
  const idleSeqIndexRef = useRef(-1)
  const [poseIndex, setPoseIndex] = useState(0)

  // Keep non-idle pose lists in sync before paint (avoids one-frame stale mood).
  if (mood !== 'idle') {
    posesRef.current = posesForMood(mood)
  }

  useEffect(() => {
    if (reducedMotion) {
      setPoseIndex(0)
      return
    }

    if (mood === 'idle') {
      const picked = buildIdleSequence(idleSeqIndexRef.current)
      idleSeqIndexRef.current = picked.index
      posesRef.current = picked.poses
    } else {
      posesRef.current = posesForMood(mood)
    }
    setPoseIndex(0)

    const ms = frameMsForMood(mood)
    const timer = setInterval(() => {
      setPoseIndex((i: number) => {
        const list = posesRef.current
        const next = i + 1
        if (mood === 'idle' && next >= list.length) {
          const picked = buildIdleSequence(idleSeqIndexRef.current)
          idleSeqIndexRef.current = picked.index
          posesRef.current = picked.poses
          return 0
        }
        return next % list.length
      })
    }, ms)

    return () => clearInterval(timer)
  }, [mood, reducedMotion])

  const pose: ClawdPose = reducedMotion
    ? reducedPoseForMood(mood)
    : (posesRef.current[poseIndex % posesRef.current.length] ?? 'default')

  if (inline) {
    return <Clawd inline pose={pose} />
  }

  if (!reducedMotion) {
    return (
      <Box height={BLINK_BUDDY_HEIGHT} flexDirection="column" flexShrink={0}>
        <Clawd pose={pose} />
      </Box>
    )
  }

  return <AnimatedClawd />
}

/** Explore / read / search family → research mood. */
const RESEARCH_TOOL_RE =
  /^(Explore|Agent|Grep|Glob|Read|WebSearch|WebFetch|NotebookRead|SemanticSearch)/i

/** Write / edit / shell while building → coding mood. */
const CODING_TOOL_RE =
  /^(Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|FileWrite|FileEdit)/i

export function isResearchToolName(name: string): boolean {
  const bare = name.replace(/^mcp__[^_]+__/, '')
  return RESEARCH_TOOL_RE.test(bare)
}

export function isCodingToolName(name: string): boolean {
  const bare = name.replace(/^mcp__[^_]+__/, '')
  return CODING_TOOL_RE.test(bare)
}

/** Resolve mascot mood from session mode, working state, and active tools. */
export function resolveClawdMood(input: {
  isWorking: boolean
  permissionMode?: string
  activeToolNames?: readonly string[]
}): ClawdMood {
  const { isWorking, permissionMode, activeToolNames = [] } = input
  if (isWorking) {
    if (activeToolNames.some(isResearchToolName)) return 'researching'
    if (activeToolNames.some(isCodingToolName)) return 'coding'
    if (
      permissionMode === 'acceptEdits' ||
      permissionMode === 'bypassPermissions'
    ) {
      return 'coding'
    }
    if (permissionMode === 'plan') return 'planning'
    return 'talking'
  }
  if (permissionMode === 'acceptEdits' || permissionMode === 'plan') {
    return 'listening'
  }
  return 'idle'
}

import type { ReactNode } from 'react'
import { Box, Text, useAnimationFrame } from '../../ink.js'
import { BLINK_VERSION } from '../../constants/blink.js'
import { useSettings } from '../../hooks/useSettings.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { SpinnerGlyph } from '../Spinner/SpinnerGlyph.js'
import {
  formatElapsedSeconds,
  getBlinkStartupElapsedMs,
  type BlinkStartupPhase,
} from '../../utils/blinkStartupLoader.js'

type Props = {
  phase?: BlinkStartupPhase
}

const PHASE_VERB: Record<BlinkStartupPhase, string> = {
  launch: 'Starting up',
  compile: 'Compiling',
  modules: 'Loading modules',
  ui: 'Opening UI',
  ready: 'Ready',
}

const PHASE_PROGRESS: Record<BlinkStartupPhase, number> = {
  launch: 10,
  compile: 30,
  modules: 60,
  ui: 85,
  ready: 100,
}

const DOT_FRAMES = ['.  ', '.. ', '...', '   ']

const BOOT_TIPS = [
  'Tip: /code to allow file edits',
  'Tip: /plan to draft before building',
  'Tip: /model to switch providers',
  'Tip: /btw for a quick side question',
  'Tip: /agent start for longer tasks',
  'Tip: Press ? for shortcuts',
  'Tip: /superthink for deep reasoning',
  'Tip: /deep-research for web research',
  'Tip: /compare to benchmark models',
  'Tip: /guide for full documentation',
]

const PROGRESS_BAR_WIDTH = 26

function renderProgressBar(
  progress: number,
  frame: number,
  reducedMotion: boolean,
): ReactNode {
  const filled = Math.round((progress / 100) * PROGRESS_BAR_WIDTH)
  const glint = reducedMotion || filled < 2 ? -1 : frame % filled
  return (
    <Text>
      <Text color="subtle" dimColor>{'['}</Text>
      {Array.from({ length: PROGRESS_BAR_WIDTH }, (_, index) => {
        const active = index < filled
        const bright = index === glint || index === glint - 1
        return (
          <Text
            key={index}
            color={active ? (bright ? 'blinkSecondary' : 'blinkPrimary') : 'subtle'}
            bold={bright}
            dimColor={!active}
          >
            {active ? '━' : '·'}
          </Text>
        )
      })}
      <Text color="subtle" dimColor>{']'}</Text>
    </Text>
  )
}

function renderGradientBlink(): ReactNode {
  const colors = ['#22d3ee', '#38bdf8', '#818cf8', '#a78bfa', '#c084fc']
  return (
    <Text>
      <Text bold>
        <Text color={colors[0]}>B</Text>
        <Text color={colors[1]}>l</Text>
        <Text color={colors[2]}>i</Text>
        <Text color={colors[3]}>n</Text>
        <Text color={colors[4]}>k</Text>
      </Text>
    </Text>
  )
}

/** Compact one-line boot flash — replaces the old full-viewport splash. */
export function BlinkBootScreen({ phase = 'ui' }: Props): ReactNode {
  const reducedMotion = useSettings().prefersReducedMotion ?? false
  const { columns } = useTerminalSize()
  const [viewportRef, time] = useAnimationFrame(reducedMotion ? null : 200)
  const frame = reducedMotion ? 0 : Math.floor(time / 200)
  const elapsed = formatElapsedSeconds(getBlinkStartupElapsedMs() || time)
  const verb = PHASE_VERB[phase]
  const dots = DOT_FRAMES[frame % DOT_FRAMES.length]
  const progress = PHASE_PROGRESS[phase]
  const tip = BOOT_TIPS[
    reducedMotion ? 0 : Math.floor(frame / 9) % BOOT_TIPS.length
  ]

  return (
    <Box
      ref={viewportRef}
      flexDirection="column"
      width={columns}
      alignItems="center"
      paddingY={0}
    >
      <Box flexDirection="row" gap={1} alignItems="center">
        {renderGradientBlink()}
        <Text color="inactive" dimColor>v{BLINK_VERSION}</Text>
        <Text color="blinkPrimary" bold>{verb}{dots}</Text>
        <Text color="inactive" dimColor>{elapsed}</Text>
      </Box>
      <Box flexDirection="row" marginTop={0}>
        {renderProgressBar(progress, frame, reducedMotion)}
      </Box>
      {columns >= 70 ? (
        <Text color="inactive" dimColor>{tip}</Text>
      ) : null}
    </Box>
  )
}

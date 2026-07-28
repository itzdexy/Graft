import type { ReactNode } from 'react'
import { Box, Text, useAnimationFrame } from '../../ink.js'
import { TOVYR_VERSION } from '../../constants/tovyr.js'
import { useAppStateMaybeOutsideOfProvider } from '../../state/AppState.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { SpinnerGlyph } from '../Spinner/SpinnerGlyph.js'
import {
  formatElapsedSeconds,
  getTovyrStartupElapsedMs,
  type TovyrStartupPhase,
} from '../../utils/tovyrStartupLoader.js'

type Props = {
  phase?: TovyrStartupPhase
}

const PHASE_VERB: Record<TovyrStartupPhase, string> = {
  launch: 'Starting up',
  compile: 'Compiling',
  modules: 'Loading modules',
  ui: 'Opening UI',
  ready: 'Ready',
}

const PHASE_PROGRESS: Record<TovyrStartupPhase, number> = {
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
            color={active ? (bright ? 'tovyrSecondary' : 'tovyrPrimary') : 'subtle'}
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

function renderGradientTovyr(): ReactNode {
  const colors = ['#2dd4bf', '#22d3ee', '#38bdf8', '#6366f1', '#a78bfa']
  return (
    <Text>
      <Text bold>
        <Text color={colors[0]}>T</Text>
        <Text color={colors[1]}>O</Text>
        <Text color={colors[2]}>V</Text>
        <Text color={colors[3]}>Y</Text>
        <Text color={colors[4]}>R</Text>
      </Text>
    </Text>
  )
}

/** Compact one-line boot flash — replaces the old full-viewport splash. */
export function TovyrBootScreen({ phase = 'ui' }: Props): ReactNode {
  // The boot screen is rendered before AppStateProvider exists. Once the
  // provider mounts, this selector becomes reactive like the normal hook.
  const reducedMotion =
    useAppStateMaybeOutsideOfProvider(
      state => state.settings.prefersReducedMotion,
    ) ?? false
  const { columns } = useTerminalSize()
  const [viewportRef, time] = useAnimationFrame(reducedMotion ? null : 200)
  const frame = reducedMotion ? 0 : Math.floor(time / 200)
  const elapsed = formatElapsedSeconds(getTovyrStartupElapsedMs() || time)
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
        {renderGradientTovyr()}
        <Text color="inactive" dimColor>v{TOVYR_VERSION}</Text>
        <Text color="tovyrPrimary" bold>{verb}{dots}</Text>
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

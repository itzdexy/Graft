import type { ReactNode } from 'react'
import { Box, Text, useAnimationFrame } from '../../ink.js'
import { TOVYR_VERSION } from '../../constants/tovyr.js'
import { useAppStateMaybeOutsideOfProvider } from '../../state/AppState.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import {
  formatElapsedSeconds,
  getTovyrStartupElapsedMs,
  type TovyrStartupPhase,
} from '../../utils/tovyrStartupLoader.js'

type Props = { phase?: TovyrStartupPhase }

const PHASE_VERB: Record<TovyrStartupPhase, string> = {
  launch: 'Starting up', compile: 'Compiling', modules: 'Loading modules', ui: 'Opening UI', ready: 'Ready',
}
const PHASE_PROGRESS: Record<TovyrStartupPhase, number> = {
  launch: 10, compile: 30, modules: 60, ui: 85, ready: 100,
}
const BOOT_TIPS = [
  'Tip: /code to allow file edits', 'Tip: /plan to draft before building',
  'Tip: /model to switch providers', 'Tip: /btw for a quick side question',
  'Tip: /agent start for longer tasks', 'Tip: Press ? for shortcuts',
  'Tip: /superthink for deep reasoning', 'Tip: /deep-research for web research',
  'Tip: /compare to benchmark models', 'Tip: /guide for full documentation',
]
const RING_FRAMES = ['◐', '◓', '◑', '◒'] as const

/** Compact boot transition rendered by main before the interactive REPL mounts. */
export function TovyrBootScreen({ phase = 'ui' }: Props): ReactNode {
  const reducedMotion =
    useAppStateMaybeOutsideOfProvider(state => state.settings.prefersReducedMotion) ?? false
  const { columns } = useTerminalSize()
  const [viewportRef, time] = useAnimationFrame(reducedMotion ? null : 200)
  const elapsed = formatElapsedSeconds(getTovyrStartupElapsedMs() || time)
  const tip = BOOT_TIPS[reducedMotion ? 0 : Math.floor(time / 1800) % BOOT_TIPS.length]
  const isReady = phase === 'ready'

  return (
    <Box ref={viewportRef} flexDirection="column" width={columns} alignItems="center" paddingY={0}>
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text color="tovyrPrimary" bold>Tovyr</Text>
        <Text color="inactive" dimColor>v{TOVYR_VERSION}</Text>
        <Text color="tovyrPrimary" bold>
          {isReady ? 'Welcome to Tovyr' : RING_FRAMES[Math.floor(time / 200) % RING_FRAMES.length]}
        </Text>
        {!isReady ? <Text color="tovyrPrimary" bold>{PHASE_VERB[phase]}</Text> : null}
        <Text color="inactive" dimColor>{elapsed}</Text>
      </Box>
      {columns >= 70 ? <Text color="inactive" dimColor>{tip}</Text> : null}
    </Box>
  )
}

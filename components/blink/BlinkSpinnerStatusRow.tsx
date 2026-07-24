import { useMemo, type ReactNode, type RefObject } from 'react'
import { Box, Text, useAnimationFrame } from '../../ink.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { useSettings } from '../../hooks/useSettings.js'
import { GlimmerMessage } from '../Spinner/GlimmerMessage.js'
import { SpinnerGlyph } from '../Spinner/SpinnerGlyph.js'
import type { SpinnerMode } from '../Spinner.js'
import { useStalledAnimation } from '../Spinner/useStalledAnimation.js'
import type { Theme } from '../../utils/theme.js'

type Props = {
  label: string
  mode: SpinnerMode
  responseLengthRef?: RefObject<number>
  hasActiveTools?: boolean
  /** When the buddy is visible, skip the braille glyph (one live indicator). */
  hideGlyph?: boolean
}

const MESSAGE_COLOR: keyof Theme = 'blinkPrimary'
const SHIMMER_COLOR: keyof Theme = 'subtle'

function suppressStall(
  mode: SpinnerMode,
  currentResponseLength: number,
  hasActiveTools: boolean,
): boolean {
  if (hasActiveTools) return true
  if (currentResponseLength === 0) return true
  return mode === 'requesting' || mode === 'thinking' || mode === 'tool-input'
}

/** OpenCode-style status row for Blink dock — optional glyph + glimmer label. */
export function BlinkSpinnerStatusRow({
  label,
  mode,
  responseLengthRef,
  hasActiveTools = false,
  hideGlyph = false,
}: Props): ReactNode {
  const reducedMotion = useSettings().prefersReducedMotion ?? false
  // 120ms — cheaper on Windows than 50ms full Ink redraws
  const [viewportRef, time] = useAnimationFrame(reducedMotion ? null : 120)

  const currentResponseLength = responseLengthRef?.current ?? 0
  const skipStall = suppressStall(mode, currentResponseLength, hasActiveTools)
  const { isStalled, stalledIntensity } = useStalledAnimation(
    time,
    currentResponseLength,
    skipStall,
    reducedMotion,
  )

  const frame = reducedMotion ? 0 : Math.floor(time / 120)
  const glimmerSpeed = mode === 'requesting' ? 80 : 180
  const glimmerMessageWidth = useMemo(() => stringWidth(label), [label])
  const cycleLength = glimmerMessageWidth + 20
  const cyclePosition = Math.floor(time / glimmerSpeed)
  const glimmerIndex = reducedMotion
    ? -100
    : isStalled
      ? -100
      : mode === 'requesting'
        ? (cyclePosition % cycleLength) - 10
        : glimmerMessageWidth + 10 - (cyclePosition % cycleLength)
  const flashOpacity =
    reducedMotion || mode !== 'tool-use'
      ? 0
      : (Math.sin((time / 800) * Math.PI) + 1) / 2

  return (
    <Box ref={viewportRef} flexDirection="row" flexWrap="wrap" width="100%">
      {hideGlyph ? (
        <Text color={MESSAGE_COLOR} bold>{'> '}</Text>
      ) : (
        <SpinnerGlyph
          frame={frame}
          messageColor={MESSAGE_COLOR}
          stalledIntensity={stalledIntensity}
          reducedMotion={reducedMotion}
          time={time}
        />
      )}
      <GlimmerMessage
        message={label}
        mode={mode}
        messageColor={MESSAGE_COLOR}
        glimmerIndex={glimmerIndex}
        flashOpacity={flashOpacity}
        shimmerColor={SHIMMER_COLOR}
        stalledIntensity={stalledIntensity}
      />
    </Box>
  )
}

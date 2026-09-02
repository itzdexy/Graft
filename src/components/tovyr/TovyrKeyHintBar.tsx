import { memo, type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import {
  IMPLEMENTED_KEYBINDINGS,
  useTovyrCommandIndex,
} from '../../services/tovyr/dx/commandIndex.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'

export type KeyHint = { keys: string; action: string }

/**
 * Ordered by the shared command index. Narrow terminals drop from the end, so
 * its ordering is also the order users see in the footer.
 */
const GAP = 2
const FALLBACK_HINTS: KeyHint[] = IMPLEMENTED_KEYBINDINGS
  .filter(binding => binding.description !== 'interrupt')
  .map(binding => ({ keys: binding.keys, action: binding.description }))

function hintWidth(hint: KeyHint): number {
  return hint.keys.length + 1 + hint.action.length
}

/**
 * Fits as many hints as the row allows, dropping the least-used first. Returns
 * them in display order.
 */
export function fitKeyHints(
  available: number,
  hints: KeyHint[] = FALLBACK_HINTS,
): KeyHint[] {
  const fitted: KeyHint[] = []
  let used = 0
  for (const hint of hints) {
    const width = hintWidth(hint) + (fitted.length > 0 ? GAP : 0)
    if (used + width > available) break
    used += width
    fitted.push(hint)
  }
  return fitted
}

/**
 * Bottom rail: interrupt state on the left, context usage and shortcuts right.
 *
 * The context readout sits here rather than in the composer because it is
 * status, not input — and because a reader scanning for "how much room is
 * left" looks at the same place every time.
 */
export const TovyrKeyHintBar = memo(function TovyrKeyHintBar({
  isLoading,
  contextUsage,
}: {
  isLoading: boolean
  /** Preformatted `16.6K (2%)`, or null when nothing has been sent yet. */
  contextUsage?: string | null
}): ReactNode {
  const { columns } = useTerminalSize()
  const indexedHints = useTovyrCommandIndex([])
    .filter(entry => entry.kind === 'shortcut')
    .map(entry => ({ keys: entry.keys ?? '', action: entry.description }))
  const interruptHint = indexedHints.find(hint => hint.action === 'interrupt')
  const hints = indexedHints.filter(hint => hint !== interruptHint)
  const leftWidth = isLoading && interruptHint ? hintWidth(interruptHint) : 0
  const usage = contextUsage?.trim() || ''
  // Two columns of padding, a gap between clusters, and the usage readout.
  const available =
    columns - leftWidth - 4 - GAP - (usage ? usage.length + GAP : 0)
  const fittedHints = fitKeyHints(Math.max(0, available), hints)

  if (!isLoading && fittedHints.length === 0 && !usage) return null

  // One flat Text per side. Nested Boxes with `gap` inside a space-between row
  // mis-measured here and ran the clusters together ("commandsshift+tab"), so
  // the separators are explicit characters rather than layout.
  const separator = ' '.repeat(GAP)

  return (
    <Box
      flexDirection="row"
      width="100%"
      height={1}
      flexShrink={0}
      overflow="hidden"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text wrap="truncate-end">
        {isLoading && interruptHint ? (
          <>
            <Text color="warning">{interruptHint.keys}</Text>
            <Text color="subtle" dimColor>{` ${interruptHint.action}`}</Text>
          </>
        ) : (
          ' '
        )}
      </Text>
      <Text wrap="truncate-end">
        {usage ? (
          <Text color="subtle" dimColor>{usage}</Text>
        ) : null}
        {fittedHints.map((hint, index) => (
          <Text key={hint.keys}>
            {index > 0 || usage ? separator : ''}
            <Text color="inactive">{hint.keys}</Text>
            <Text color="subtle" dimColor>{` ${hint.action}`}</Text>
          </Text>
        ))}
      </Text>
    </Box>
  )
})

import { useMemo, type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import {
  BLINK_EXAMPLE_PROMPTS,
  type BlinkExamplePrompt,
} from '../../services/blink/dx/blinkExamplePrompts.js'

export type { BlinkExamplePrompt }
export { BLINK_EXAMPLE_PROMPTS }

type Props = {
  /** Shown under header — skip duplicate branding. */
  compact?: boolean
}

function pickPrompts(): BlinkExamplePrompt[] {
  const shuffled = [...BLINK_EXAMPLE_PROMPTS]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 3)
}

/**
 * Idle empty surface — compact, informative.
 * Shows 3 example prompts and keyboard shortcut hints.
 */
export function BlinkEmptyState({ compact = false }: Props): ReactNode {
  const prompts = useMemo(pickPrompts, [])

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      marginTop={compact ? 0 : 0}
      marginBottom={0}
      alignItems={compact ? undefined : 'flex-start'}
      gap={0}
    >
      {!compact ? (
        <>
          <Box flexDirection="column" marginTop={0} gap={0}>
            <Text dimColor bold color="blinkPrimary">
              <Text color="blinkPrimary">{'| '}</Text>Try asking
            </Text>
            {prompts.map(prompt => (
              <Text key={prompt.label}>
                <Text color="blinkPrimary" bold>{'> '}</Text>
                <Text color="blinkPrimary" bold>{prompt.label}</Text>
                <Text color="subtle" dimColor> -- {prompt.hint}</Text>
              </Text>
            ))}
          </Box>
          <Box flexDirection="row" marginTop={0}>
            <Text color="subtle" dimColor>
              <Text color="blinkPrimary" bold>?</Text> help{' · '}
              <Text color="blinkPrimary" bold>/</Text> commands{' · '}
              <Text color="blinkPrimary" bold>Up</Text> history{' · '}
              <Text color="blinkPrimary" bold>Esc</Text> cancel
            </Text>
          </Box>
        </>
      ) : (
        <Text color="subtle" dimColor>
          <Text color="blinkPrimary" bold>?</Text> help{' · '}
          <Text color="blinkPrimary" bold>/</Text> commands{' · '}
          <Text color="blinkPrimary" bold>Up</Text> history{' · '}
          <Text color="blinkPrimary" bold>Esc</Text> cancel
        </Text>
      )}
    </Box>
  )
}

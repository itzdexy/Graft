import * as React from 'react'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import { Pane } from '../../components/design-system/Pane.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

type Recovery = { code: string; title: string; description: string; action: string }

const RECOVERIES: Recovery[] = [
  {
    code: 'auth',
    title: 'Provider authentication failed',
    description: 'The active provider rejected the request, usually because the API key is missing, expired, or wrong.',
    action: 'Run /provider to switch providers or /config to set a key.',
  },
  {
    code: 'rate-limit',
    title: 'Rate limit hit',
    description: 'The provider is throttling requests right now.',
    action: 'Wait a moment, or switch model/provider with /model or /provider.',
  },
  {
    code: 'timeout',
    title: 'Request timed out',
    description: 'The model took too long to respond.',
    action: 'Try a faster model (/model) or enable auto-failover with TOVYR_AUTO_FAILOVER=1.',
  },
  {
    code: 'tool-error',
    title: 'Tool call failed',
    description: 'A shell, file, or edit command returned an error.',
    action: 'Check the full error output, fix the underlying issue, then retry.',
  },
  {
    code: 'context',
    title: 'Context window exceeded',
    description: 'The conversation is too long for the current model.',
    action: 'Run /compact to summarize context, /continue to fork, or switch to a larger model (/model).',
  },
]

function RecoveryItem({ recovery }: { recovery: Recovery; key?: React.Key }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>✕ {recovery.title}</Text>
      <Text dimColor>{recovery.description}</Text>
      <Text color="suggestion">💡 {recovery.action}</Text>
    </Box>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  const query = args.trim().toLowerCase()
  const recoveries = query
    ? RECOVERIES.filter(r => r.code.includes(query) || r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query))
    : RECOVERIES

  return (
    <Pane color="warning">
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="warning">Recovery Help</Text>
        <Text dimColor>Common errors and how to get back on track.</Text>
        {recoveries.length === 0 ? (
          <Text dimColor marginTop={1}>No matches for "{query}". Try /oops with no argument.</Text>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            {recoveries.map((r, i) => (
              <RecoveryItem key={i} recovery={r} />
            ))}
          </Box>
        )}
      </Box>
    </Pane>
  )
}

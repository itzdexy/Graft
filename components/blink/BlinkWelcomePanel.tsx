import { basename } from 'path'
import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { useAppState } from '../../state/AppState.js'
import { getCwd } from '../../utils/cwd.js'

type WelcomeAction = {
  command: string
  label: string
}

const ACTIONS: WelcomeAction[] = [
  { command: '/model', label: 'switch model' },
  { command: '/code', label: 'allow file edits' },
  { command: '/plan', label: 'draft a plan' },
  { command: '/mcp', label: 'manage connected tools' },
  { command: '/agent start', label: 'run a longer task' },
  { command: '/guide', label: 'full documentation' },
  { command: '/blink', label: 'settings & config' },
]

function renderGradientBlink(): ReactNode {
  const colors = ['#2dd4bf', '#22d3ee', '#38bdf8', '#0ea5e9', '#0284c7']
  const codeColors = ['#3b82f6', '#6366f1', '#818cf8', '#a78bfa']
  return (
    <Text>
      <Text bold>
        <Text color={colors[0]}>K</Text>
        <Text color={colors[1]}>a</Text>
        <Text color={colors[2]}>i</Text>
        <Text color={colors[3]}>r</Text>
        <Text color={colors[4]}>o</Text>{' '}
        <Text color={codeColors[0]}>C</Text>
        <Text color={codeColors[1]}>o</Text>
        <Text color={codeColors[2]}>d</Text>
        <Text color={codeColors[3]}>e</Text>
      </Text>
    </Text>
  )
}

/** First-run chat surface for Blink's fullscreen UI. */
export function BlinkWelcomePanel(): ReactNode {
  const project = basename(getCwd()) || getCwd()
  const mcpClients = useAppState(s => s.mcp.clients)
  const mcpTotal = mcpClients.length
  const mcpConnected = mcpClients.filter(c => c.type === 'connected').length
  const mcpFailed = mcpClients.filter(c => c.type === 'failed').length
  const mcpNeedsAuth = mcpClients.filter(c => c.type === 'needs-auth').length
  const mcpAttention = mcpFailed + mcpNeedsAuth

  return (
    <Box flexDirection="column" paddingX={2} marginTop={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="blinkPrimary"
        borderDimColor
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="row" justifyContent="space-between" width="100%">
          {renderGradientBlink()}
          <Text color="subtle" dimColor wrap="truncate-end">
            {project}
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text color="subtle" dimColor>
            <Text color="blinkPrimary" bold>{'> '}</Text>Ask naturally, or give Blink a build/fix task. Use{' '}
            <Text color="blinkPrimary" bold>/code</Text>
            {' '}before file edits.
          </Text>
        </Box>

        <Box marginTop={0}>
          <Text color="subtle" dimColor>
            <Text color="blinkPrimary" bold>{'> '}</Text>Press{' '}
            <Text color="blinkPrimary" bold>?</Text>
            {' '}for shortcuts. Press{' '}
            <Text color="blinkPrimary" bold>/</Text>
            {' '}to see all commands.
          </Text>
        </Box>

        {mcpTotal > 0 ? (
          <Box flexDirection="row" marginTop={1} gap={1}>
            <Text dimColor color="subtle">
              <Text color={mcpConnected > 0 ? 'success' : 'subtle'} bold>
                {'*'}
              </Text>
              {' '}
              {mcpConnected}/{mcpTotal} MCP connected
            </Text>
            {mcpFailed > 0 ? (
              <Text color="error" dimColor>
                <Text color="error" bold>{'! '}</Text>{mcpFailed} failed
              </Text>
            ) : null}
            {mcpNeedsAuth > 0 ? (
              <Text color="warning" dimColor>
                <Text color="warning" bold>{'? '}</Text>{mcpNeedsAuth} need auth
              </Text>
            ) : null}
          </Box>
        ) : (
          <Box marginTop={1}>
            <Text color="subtle" dimColor>
              <Text color="inactive" bold>{'o '}</Text>No MCP servers — use /mcp to add
            </Text>
          </Box>
        )}

        <Box
          borderStyle="single"
          borderColor="subtle"
          borderDimColor
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          marginTop={1}
          marginBottom={0}
        />

        <Box marginTop={1}>
          <Text color="blinkPrimary" dimColor bold>
            <Text color="blinkPrimary">{'| '}</Text>Quick start
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={0}>
          {ACTIONS.map(action => (
            <Text key={action.command}>
              <Text color="blinkPrimary" bold>
                {'> '}
                {action.command}
              </Text>
              <Text color="subtle" dimColor>
                {' -- '}
                {action.label}
              </Text>
            </Text>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

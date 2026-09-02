import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { TOVYR_TAGLINE, TOVYR_VERSION } from '../../constants/tovyr.js'
import { lookupTovyrModelLabel } from '../../../scripts/tovyr-provider-catalog.js'
import { resolveActive } from '../../../scripts/tovyr-providers.js'
import { platformLabel } from '../../../scripts/tovyr-home.js'

type QuickStartRow = {
  label: string
  commands: string[]
}

const ROWS: QuickStartRow[] = [
  { label: 'Chat', commands: ['just type', '/btw'] },
  { label: 'Build & fix', commands: ['/build', '/fix', '/debug'] },
  { label: 'Plan -> code', commands: ['/plan', '/code', '/review'] },
  { label: 'Agents', commands: ['/agent start', '/agent --autofix'] },
  { label: 'Research', commands: ['/deep-research', '/superthink'] },
  { label: 'Models', commands: ['/compare', '/provider list'] },
  { label: 'Setup', commands: ['/guide', '/tovyr'] },
]

const TIPS = [
  { label: 'Shell', value: 'tovyr build a rust web server' },
  { label: 'Side question', value: '/btw' },
  { label: 'First launch slow?', value: 'npm run warm' },
  { label: 'Shortcuts', value: 'Press ? anytime' },
]

function readActiveConnection(): { provider: string; model: string } | null {
  const active = resolveActive()
  if (!active) return null
  return {
    provider: active.label,
    model: lookupTovyrModelLabel(active.model) || active.model,
  }
}

function QuickStartRowView({ label, commands }: QuickStartRow): ReactNode {
  return (
    <Box flexDirection="row" key={label}>
      <Text color="tovyrPrimary" dimColor bold>
        {label}:
      </Text>
      <Text>{' '}</Text>
      {commands.map((cmd, i) => (
        <Text key={cmd}>
          {i > 0 && (
            <Text dimColor color="subtle">
              {' | '}
            </Text>
          )}
          <Text color="tovyrPrimary" bold>
            {cmd}
          </Text>
        </Text>
      ))}
    </Box>
  )
}

/** OpenCode-style quick-start content for the welcome-screen. */
export function TovyrQuickStartPanel(): ReactNode {
  const conn = readActiveConnection()

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text color="tovyrPrimary" dimColor>
          {TOVYR_TAGLINE}
        </Text>
        <Text dimColor color="subtle">
          <Text color="tovyrPrimary" bold>v{TOVYR_VERSION}</Text> <Text color="subtle">·</Text> {platformLabel()}
        </Text>
        {conn ? (
          <Text dimColor color="subtle">
            {conn.provider} <Text color="subtle">·</Text> <Text color="tovyrPrimary" bold>{conn.model}</Text>
          </Text>
        ) : null}
      </Box>
      <Box flexDirection="column">
        <Text color="tovyrPrimary" dimColor bold>
          <Text color="tovyrPrimary">{'| '}</Text>Commands
        </Text>
        {ROWS.map(row => (
          <QuickStartRowView key={row.label} {...row} />
        ))}
      </Box>
      <Box flexDirection="column" gap={0}>
        <Text color="tovyrPrimary" dimColor bold>
          <Text color="tovyrPrimary">{'| '}</Text>Tips
        </Text>
        {TIPS.map(tip => (
          <Text key={tip.label} dimColor color="subtle">
            <Text color="tovyrPrimary" bold>{'> '}</Text>{tip.label}:{' '}
            <Text color="tovyrPrimary">{tip.value}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  )
}

/** Width estimate for Feed layout. */
export function tovyrQuickStartPanelWidth(): number {
  const longest = Math.max(
    TOVYR_TAGLINE.length,
    ...ROWS.flatMap(r => [
      r.label.length + r.commands.join(' | ').length + 2,
    ]),
    ...TIPS.map(t => t.label.length + t.value.length + 4),
  )
  return longest
}

import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { GRAFT_TAGLINE, GRAFT_VERSION } from '../../constants/graft.js'
import { lookupGraftModelLabel } from '../../../scripts/graft-provider-catalog.js'
import { resolveActive } from '../../../scripts/graft-providers.js'
import { platformLabel } from '../../../scripts/graft-home.js'

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
  { label: 'Setup', commands: ['/guide', '/graft'] },
]

const TIPS = [
  { label: 'Shell', value: 'graft build a rust web server' },
  { label: 'Side question', value: '/btw' },
  { label: 'First launch slow?', value: 'npm run warm' },
  { label: 'Shortcuts', value: 'Press ? anytime' },
]

function readActiveConnection(): { provider: string; model: string } | null {
  const active = resolveActive()
  if (!active) return null
  return {
    provider: active.label,
    model: lookupGraftModelLabel(active.model) || active.model,
  }
}

function QuickStartRowView({ label, commands }: QuickStartRow): ReactNode {
  return (
    <Box flexDirection="row" key={label}>
      <Text color="graftPrimary" dimColor bold>
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
          <Text color="graftPrimary" bold>
            {cmd}
          </Text>
        </Text>
      ))}
    </Box>
  )
}

/** OpenCode-style quick-start content for the welcome-screen. */
export function GraftQuickStartPanel(): ReactNode {
  const conn = readActiveConnection()

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text color="graftPrimary" dimColor>
          {GRAFT_TAGLINE}
        </Text>
        <Text dimColor color="subtle">
          <Text color="graftPrimary" bold>v{GRAFT_VERSION}</Text> <Text color="subtle">·</Text> {platformLabel()}
        </Text>
        {conn ? (
          <Text dimColor color="subtle">
            {conn.provider} <Text color="subtle">·</Text> <Text color="graftPrimary" bold>{conn.model}</Text>
          </Text>
        ) : null}
      </Box>
      <Box flexDirection="column">
        <Text color="graftPrimary" dimColor bold>
          <Text color="graftPrimary">{'| '}</Text>Commands
        </Text>
        {ROWS.map(row => (
          <QuickStartRowView key={row.label} {...row} />
        ))}
      </Box>
      <Box flexDirection="column" gap={0}>
        <Text color="graftPrimary" dimColor bold>
          <Text color="graftPrimary">{'| '}</Text>Tips
        </Text>
        {TIPS.map(tip => (
          <Text key={tip.label} dimColor color="subtle">
            <Text color="graftPrimary" bold>{'> '}</Text>{tip.label}:{' '}
            <Text color="graftPrimary">{tip.value}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  )
}

/** Width estimate for Feed layout. */
export function graftQuickStartPanelWidth(): number {
  const longest = Math.max(
    GRAFT_TAGLINE.length,
    ...ROWS.flatMap(r => [
      r.label.length + r.commands.join(' | ').length + 2,
    ]),
    ...TIPS.map(t => t.label.length + t.value.length + 4),
  )
  return longest
}

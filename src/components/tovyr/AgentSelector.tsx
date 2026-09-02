import * as React from 'react'
import { Box, Text, useInput } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { useRegisterOverlay } from '../../context/overlayContext.js'
import { Centered } from '../design-system/Centered.js'
import { SPACING } from '../design-system/spacing.js'

type Agent = {
  id: string
  name: string
  description: string
  icon?: string
}

type Props = {
  agents: Agent[]
  activeId: string
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * Tab-triggered mode/agent switcher. Lists modes/agents with a short
 * one-line description and a visible active marker.
 */
export function AgentSelector({
  agents,
  activeId,
  onSelect,
  onClose,
}: Props): React.ReactNode {
  useRegisterOverlay('agent-selector', true)
  const { columns } = useTerminalSize()
  const [selectedIndex, setSelectedIndex] = React.useState(() =>
    Math.max(0, agents.findIndex(a => a.id === activeId)),
  )

  useInput((_input: string, key: any) => {
    if (key.escape || (key.ctrl && key.name === 'c')) {
      onClose()
      return
    }
    if (key.return) {
      const agent = agents[selectedIndex]
      if (agent) onSelect(agent.id)
      return
    }
    if (key.upArrow) {
      setSelectedIndex((i: number) => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex((i: number) => Math.min(agents.length - 1, i + 1))
      return
    }
  })

  const width = Math.min(columns - SPACING.md, 60)

  return (
    <Centered maxWidth={64} minWidth={40} paddingX={2}>
      <Box flexDirection="column" width={width} paddingX={1} paddingY={1} borderStyle="round" borderColor="tovyrPrimary">
        <Box marginBottom={1}>
          <Text color="tovyrPrimary" bold>Switch agent/mode</Text>
        </Box>
        {agents.map((agent, i) => {
          const isActive = agent.id === activeId
          const isSelected = i === selectedIndex
          return (
            <Box key={agent.id} flexDirection="row" gap={1}>
              <Text color={isSelected ? 'tovyrPrimary' : 'subtle'} bold={isSelected}>
                {isActive ? '●' : isSelected ? '›' : ' '}
              </Text>
              <Text color={isSelected ? 'tovyrPrimary' : 'text'} bold={isSelected || isActive}>
                {agent.icon ? `${agent.icon} ` : ''}{agent.name}
              </Text>
              <Box flexGrow={1} />
              <Text color="subtle" dimColor>
                {agent.description}
              </Text>
            </Box>
          )
        })}
        <Box marginTop={1}>
          <Text color="subtle" dimColor>
            <Text color="tovyrPrimary" bold>↑↓</Text> navigate{' · '}
            <Text color="tovyrPrimary" bold>Enter</Text> select{' · '}
            <Text color="tovyrPrimary" bold>Esc</Text> close
          </Text>
        </Box>
      </Box>
    </Centered>
  )
}

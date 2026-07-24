import * as React from 'react'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import { Pane } from '../../components/design-system/Pane.js'
import { Card } from '../../components/design-system/Card.js'
import { Section } from '../../components/design-system/Section.js'
import { Skeleton } from '../../components/design-system/Skeleton.js'
import { EmptyState, EMPTY_STATE_SPRITES } from '../../components/design-system/EmptyState.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { getCompanion } from '../../buddy/companion.js'
import { renderSprite } from '../../buddy/sprites.js'
import { RARITY_COLORS } from '../../buddy/types.js'
import { loadProjectMemory } from '../../services/blink/buddy/memory.js'
import { getCwd } from '../../utils/cwd.js'
import { getWorktreePaths } from '../../utils/getWorktreePaths.js'
import {
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  loadState,
} from '../../scripts/blink-providers.js'
import { loadSameRepoMessageLogs } from '../../utils/sessionStorage.js'
import type { LogOption } from '../../types/logs.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'

function activeConnection(): { provider: string; model: string } {
  try {
    const state = loadState()
    const id = getActiveProviderId(state)
    const def = getProvider(id, state)
    const modelId = getActiveModelId(id, state)
    const model =
      def?.models.find((m: { id: string; label?: string }) => m.id === modelId)
        ?.label || modelId || 'default'
    return { provider: def?.label || id, model }
  } catch {
    return { provider: 'FreeModel', model: 'default' }
  }
}

function projectNameFromCwd(cwd: string): string {
  return cwd.split(/[/\\]/).pop() || 'Project'
}

function formatSessionDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function MemoryCounts({ memory }: { memory: ReturnType<typeof loadProjectMemory> }) {
  return (
    <Box flexDirection="row" gap={1}>
      <Text>
        <Text dimColor>Goals</Text> <Text>{memory.goals.length}</Text>
      </Text>
      <Text>
        <Text dimColor>· Decisions</Text> <Text>{memory.decisions.length}</Text>
      </Text>
      <Text>
        <Text dimColor>· Architecture</Text> <Text>{memory.architecture.length}</Text>
      </Text>
      <Text>
        <Text dimColor>· Standards</Text> <Text>{memory.codingStandards.length}</Text>
      </Text>
    </Box>
  )
}

function RecentSessions({ sessions, loading }: { sessions: LogOption[]; loading: boolean }) {
  if (loading) return <Skeleton lines={3} width={28} />
  if (sessions.length === 0) {
    return (
      <EmptyState sprite={EMPTY_STATE_SPRITES.calendar} title="No sessions yet">
        Start chatting to see recent sessions here.
      </EmptyState>
    )
  }
  return (
    <Box flexDirection="column">
      {sessions.map((log: LogOption, i: number) => (
        <Text key={i} dimColor>
          {formatSessionDate(log.date)} · {log.messages.length} messages
        </Text>
      ))}
    </Box>
  )
}

function Dash(): React.ReactNode {
  const { columns } = useTerminalSize()
  const cwd = getCwd()
  const projectName = projectNameFromCwd(cwd)
  const conn = activeConnection()
  const memory = loadProjectMemory(cwd)
  const companion = getCompanion()
  const color = companion ? RARITY_COLORS[companion.rarity] : 'inactive'
  const sprite = companion ? renderSprite(companion, 0) : []

  const [recentSessions, setRecentSessions] = React.useState<LogOption[]>([])
  const [loadingSessions, setLoadingSessions] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const paths = await getWorktreePaths(cwd)
        const logs = await loadSameRepoMessageLogs(paths, 5)
        if (!cancelled) setRecentSessions(logs.slice(0, 5))
      } catch {
        // ignore - dashboard should still render
      } finally {
        if (!cancelled) setLoadingSessions(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [cwd])

  const header = (
    <Box flexDirection="row" marginBottom={1}>
      {companion && (
        <Box flexDirection="column" marginRight={2}>
          {sprite.slice(0, 4).map((line, i) => (
            <Text key={i} color={color}>
              {line}
            </Text>
          ))}
        </Box>
      )}
      <Box flexDirection="column">
        <Text bold color="permission">
          Blink Dashboard
        </Text>
        <Text dimColor>{projectName}</Text>
        <Text dimColor>{cwd}</Text>
      </Box>
    </Box>
  )

  const connectionSection = (
    <Section title="Connection">
      <Text>
        <Text color={color}>{conn.provider}</Text>
        <Text dimColor> · {conn.model}</Text>
      </Text>
    </Section>
  )

  const hasMemory =
    memory.goals.length > 0 ||
    memory.decisions.length > 0 ||
    memory.architecture.length > 0 ||
    memory.codingStandards.length > 0

  const memorySection = (
    <Section title={`Project Memory (${memory.projectName})`}>
      {hasMemory ? (
        <MemoryCounts memory={memory} />
      ) : (
        <EmptyState sprite={EMPTY_STATE_SPRITES.memory} title="Memory empty">
          Add goals/decisions with /buddy goal or /buddy remember.
        </EmptyState>
      )}
    </Section>
  )

  const recentSection = (
    <Section title="Recent Sessions">
      <RecentSessions sessions={recentSessions} loading={loadingSessions} />
    </Section>
  )

  const quickSection = (
    <Section title="Quick Actions">
      <Text dimColor>
        /plan · /code · /review · /analyze · /buddy · /commands · /help
      </Text>
    </Section>
  )

  const twoColumn = columns >= 80

  return (
    <Pane color="permission">
      <Card footer="Press Esc or run another command to close">
        {header}
        {twoColumn ? (
          <Box flexDirection="row" gap={4}>
            <Box flexDirection="column" width="50%">
              {connectionSection}
              {memorySection}
            </Box>
            <Box flexDirection="column" width="50%">
              {recentSection}
              {quickSection}
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column">
            {connectionSection}
            {memorySection}
            {recentSection}
            {quickSection}
          </Box>
        )}
      </Card>
    </Pane>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  return <Dash />
}

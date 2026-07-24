import * as React from 'react'
import { useEffect } from 'react'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import { Pane } from '../../components/design-system/Pane.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { getCompanion } from '../../buddy/companion.js'
import { renderSprite } from '../../buddy/sprites.js'
import { RARITY_COLORS, RARITY_STARS, STAT_NAMES } from '../../buddy/types.js'
import {
  loadProjectMemory,
  rememberProjectFact,
  removeProjectFact,
  type MemoryCategory,
} from '../../services/blink/buddy/memory.js'
import { getCwd } from '../../utils/cwd.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { renderToString } from '../../utils/staticRender.js'
import {
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  loadState,
} from '../../scripts/blink-providers.js'
import { randomBlinkTip } from '../../constants/blinkTips.js'

function activeConnection(): { provider: string; model: string } {
  try {
    const state = loadState()
    const id = getActiveProviderId(state)
    const def = getProvider(id, state)
    const modelId = getActiveModelId(id, state)
    const model = def?.models.find(m => m.id === modelId)?.label || modelId || 'default'
    return { provider: def?.label || id, model }
  } catch {
    return { provider: 'FreeModel', model: 'default' }
  }
}

function BuddyCard(): React.ReactNode {
  const companion = getCompanion()
  if (!companion) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="warning">
          Blink Buddy
        </Text>
        <Text dimColor>Starting up - run again in a moment.</Text>
      </Box>
    )
  }

  const color = RARITY_COLORS[companion.rarity]
  const sprite = renderSprite(companion, 0)
  const memory = loadProjectMemory(getCwd())
  const conn = activeConnection()

  return (
    <Pane color={color}>
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row" marginBottom={1}>
          <Box flexDirection="column" marginRight={2}>
            {sprite.map((line, i) => (
              <Text key={i} color={color}>
                {line}
              </Text>
            ))}
          </Box>
          <Box flexDirection="column">
            <Text bold color={color}>
              {companion.name}
            </Text>
            <Text dimColor>
              {companion.species} · {RARITY_STARS[companion.rarity]} {companion.rarity}
              {companion.shiny ? ' ✦' : ''}
            </Text>
            <Text wrap="wrap" marginTop={1}>
              {companion.personality}
            </Text>
          </Box>
        </Box>

        <Text bold>Stats</Text>
        {STAT_NAMES.map(stat => (
          <Text key={stat}>
            <Text dimColor>{stat.padEnd(10)}</Text>
            <Text color={color}>{'█'.repeat(Math.round(companion.stats[stat] / 10))}</Text>
            <Text dimColor> {companion.stats[stat]}</Text>
          </Text>
        ))}

        <Box marginTop={1} flexDirection="row">
          <Text bold>Connection  </Text>
          <Text color={color}>{conn.provider}</Text>
          <Text dimColor> · {conn.model} · </Text>
          <Text dimColor>/provider to switch</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Commands</Text>
          <Text dimColor>/analyze · /plan · /build · /refactor · /review · /research · /debug</Text>
          <Text dimColor>/critique · /multiagent · /pr-review · /provider</Text>
          <Text dimColor>/mode · /code · /bypass · /superthink</Text>
          <Text dimColor>/buddy tip · /buddy remember &lt;fact&gt; · /buddy goals &lt;goal&gt; · /buddy done &lt;n&gt;</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Modes</Text>
          <Text dimColor>Architect - /plan · Builder - /build /code · Reviewer - /review</Text>
          <Text dimColor>Multi-agent - /critique writer|coder · Performance - /analyze · Debug - /debug</Text>
        </Box>

        {memory.goals.length > 0 || memory.decisions.length > 0 || memory.architecture.length > 0 || memory.codingStandards.length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Project memory ({memory.projectName})</Text>
            {memory.goals.slice(0, 3).map((g, i) => (
              <Text key={`g-${i}`} dimColor>
                goal: {g}
              </Text>
            ))}
            {memory.decisions.slice(0, 2).map((d, i) => (
              <Text key={`d-${i}`} dimColor>
                decision: {d}
              </Text>
            ))}
            {memory.architecture.slice(0, 2).map((a, i) => (
              <Text key={`a-${i}`} dimColor>
                architecture: {a}
              </Text>
            ))}
            {memory.codingStandards.slice(0, 2).map((s, i) => (
              <Text key={`s-${i}`} dimColor>
                standard: {s}
              </Text>
            ))}
          </Box>
        ) : (
          <Text marginTop={1} dimColor>
            Project memory is empty - Buddy learns as you work.
          </Text>
        )}
        <Box marginTop={1}>
          <Text dimColor>Tip: Try /buddy pet, /analyze, or ask me anything in chat.</Text>
        </Box>
      </Box>
    </Pane>
  )
}

function PetAnimation({ companion, onDone }: { companion: NonNullable<ReturnType<typeof getCompanion>>; onDone: () => void }): React.ReactNode {
  const [frame, setFrame] = React.useState(0)
  const color = RARITY_COLORS[companion.rarity]
  const reactions = [
    '◆ Thanks! Ready to help.',
    `◆ ${companion.name} is happy!`,
    '◆ Pet registered. Processing affection…',
  ]

  React.useEffect(() => {
    if (frame >= reactions.length - 1) {
      const t = setTimeout(onDone, 900)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setFrame((f: number) => f + 1), 350)
    return () => clearTimeout(t)
  }, [frame, onDone])

  const sprite = renderSprite(companion, frame)

  return (
    <Box flexDirection="column" paddingX={1}>
      {sprite.map((line, i) => (
        <Text key={i} color={color}>
          {line}
        </Text>
      ))}
      <Text color={color}>{reactions[frame]}</Text>
    </Box>
  )
}

function BuddyTip(): React.ReactNode {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="permission">Buddy Tip</Text>
      <Text wrap="wrap">{randomBlinkTip()}</Text>
    </Box>
  )
}

function SuccessFlash({
  message,
  onDone,
}: {
  message: string
  onDone: (message: string) => void
}): React.ReactNode {
  useEffect(() => {
    const t = setTimeout(() => onDone(message), 700)
    return () => clearTimeout(t)
  }, [message, onDone])

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="permission" bold>
        {message}
      </Text>
      <Text dimColor>Saving…</Text>
    </Box>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  const arg = args.trim().toLowerCase()

  if (arg === 'pet') {
    const companion = getCompanion()
    if (!companion) {
      onDone('Blink Buddy is still hatching - run again in a moment.')
      return null
    }
    return <PetAnimation companion={companion} onDone={() => onDone(`${companion.name} enjoyed the pets.`)} />
  }

  if (arg === 'mute') {
    saveGlobalConfig({ companionMuted: true })
    onDone('Blink Buddy muted.')
    return null
  }

  if (arg === 'unmute') {
    saveGlobalConfig({ companionMuted: false })
    onDone('Blink Buddy unmuted.')
    return null
  }

  if (arg === 'tip') {
    const tip = randomBlinkTip()
    onDone(tip)
    return <BuddyTip />
  }

  if (arg === 'goals' || arg === 'goal') {
    const memory = loadProjectMemory(getCwd())
    if (memory.goals.length === 0) {
      onDone('No goals yet. Add one with /buddy goal <goal>.')
      return null
    }
    const lines = memory.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')
    onDone(lines)
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="permission">Goals ({memory.projectName})</Text>
        {memory.goals.map((g, i) => (
          <Text key={i}>{`${i + 1}. ${g}`}</Text>
        ))}
        <Text dimColor marginTop={1}>Mark done: /buddy done &lt;number&gt;</Text>
      </Box>
    )
  }

  if (arg.startsWith('goal ')) {
    const goal = args.trim().slice('goal '.length).trim()
    if (!goal) {
      onDone('Usage: /buddy goal <goal>')
      return null
    }
    rememberProjectFact(getCwd(), 'goals', goal)
    return <SuccessFlash message={`Goal added: ${goal}`} onDone={onDone} />
  }

  if (arg.startsWith('done ')) {
    const indexStr = args.trim().slice('done '.length).trim()
    const index = Number(indexStr)
    if (!Number.isInteger(index) || index < 1) {
      onDone('Usage: /buddy done <goal-number>')
      return null
    }
    const { removed } = removeProjectFact(getCwd(), 'goals', index - 1)
    if (removed) {
      return <SuccessFlash message={`Goal completed: ${removed}`} onDone={onDone} />
    } else {
      onDone(`Goal #${index} not found.`)
    }
    return null
  }

  if (arg.startsWith('remember ')) {
    const fact = args.trim().slice('remember '.length).trim()
    if (!fact) {
      onDone('Usage: /buddy remember <fact>  (saved under decisions)')
      return null
    }
    rememberProjectFact(getCwd(), 'decisions', fact)
    return <SuccessFlash message={`Remembered: ${fact}`} onDone={onDone} />
  }

  const rememberMatch = arg.match(
    /^(goals?|architecture|decisions?|roadmap|standards?)\s+(.+)$/i,
  )
  if (rememberMatch) {
    const raw = rememberMatch[1]!.toLowerCase()
    const fact = rememberMatch[2]!.trim()
    let category: MemoryCategory = 'decisions'
    if (raw.startsWith('goal')) category = 'goals'
    else if (raw.startsWith('architect')) category = 'architecture'
    else if (raw.startsWith('roadmap')) category = 'roadmap'
    else if (raw.startsWith('standard')) category = 'codingStandards'
    rememberProjectFact(getCwd(), category, fact)
    return <SuccessFlash message={`Saved to ${category}: ${fact}`} onDone={onDone} />
  }

  const config = getGlobalConfig()
  if (!config.companion) {
    saveGlobalConfig({
      companion: {
        name: 'Blink Buddy',
        personality:
          'Proactive senior engineer: architect, debugger, reviewer, and project manager.',
        hatchedAt: Date.now(),
      },
      companionMuted: false,
    })
  }

  const node = <BuddyCard />
  onDone(renderToString(node))
  return node
}

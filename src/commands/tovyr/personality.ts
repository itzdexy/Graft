import type { Command } from '../../commands.js'
import {
  formatPersonalityList,
  getActiveTovyrPersonality,
  setActiveTovyrPersonality,
} from '../../services/tovyr/hermes/personalities.js'

const personality: Command = {
  type: 'local',
  name: 'personality',
  description: 'Set agent persona (concise, thorough, pair, …)',
  argumentHint: '[id|list]',
  supportsNonInteractive: true,
  load: () => import('./personality.impl.js'),
}

export default personality

export function handlePersonalityCommand(args: string): string {
  const trimmed = args.trim().toLowerCase()
  if (!trimmed || trimmed === 'list') {
    const active = getActiveTovyrPersonality()
    return [
      `Active personality: **${active.name}** (\`${active.id}\`)`,
      '',
      formatPersonalityList(),
      '',
      'Usage: `/personality <id>` — takes effect on the next model turn.',
    ].join('\n')
  }
  const next = setActiveTovyrPersonality(trimmed)
  return `Personality set to **${next.name}** (\`${next.id}\`).`
}

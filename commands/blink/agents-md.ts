import type { Command } from '../../commands.js'

const agentsMd: Command = {
  type: 'local',
  name: 'agents-md',
  aliases: ['agentsmd'],
  description: 'AGENTS.md helper — init template or show current',
  argumentHint: 'init | show',
  load: () => import('./agents-md.impl.js'),
}

export default agentsMd

import type { Command } from '../../commands.js'

const goose: Command = {
  type: 'local',
  name: 'goose',
  description: 'Goose — recipes and MCP extension workflows',
  load: () => import('./goose.impl.js'),
}

export default goose

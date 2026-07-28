import type { Command } from '../../commands.js'

const opencode: Command = {
  type: 'local',
  name: 'opencode',
  description: 'OpenCode-style session tools (fork, LSP hints)',
  load: () => import('./opencode.impl.js'),
}

export default opencode

import type { Command } from '../../commands.js'

const commandsPalette: Command = {
  type: 'local-jsx',
  name: 'commands',
  description: 'Fuzzy-search and run slash commands',
  category: 'Help',
  aliases: ['cmd', 'cmds'],
  argumentHint: '[search]',
  load: () => import('./commands-palette.js'),
}

export default commandsPalette

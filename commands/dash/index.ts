import type { Command } from '../../commands.js'

const dash: Command = {
  type: 'local-jsx',
  name: 'dash',
  description: 'Open the Blink dashboard - project overview, recent sessions, and quick actions',
  category: 'Core',
  aliases: ['home', 'overview'],
  load: () => import('./dash.js'),
}

export default dash

import type { Command } from '../../commands.js'

const welcome: Command = {
  type: 'local-jsx',
  name: 'welcome',
  description: 'Show the Tovyr welcome card and quick-start guide',
  category: 'Help',
  aliases: ['start', 'getting-started'],
  load: () => import('./welcome.js'),
}

export default welcome

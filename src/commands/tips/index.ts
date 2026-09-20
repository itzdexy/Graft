import type { Command } from '../../commands.js'

const tips: Command = {
  type: 'local-jsx',
  name: 'tips',
  description: 'Show a rotating productivity tip for Graft',
  category: 'Help',
  aliases: ['tip'],
  load: () => import('./tips.js'),
}

export default tips

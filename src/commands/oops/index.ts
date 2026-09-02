import type { Command } from '../../commands.js'

const oops: Command = {
  type: 'local-jsx',
  name: 'oops',
  description: 'Show common recovery steps after an error or failure',
  category: 'Help',
  aliases: ['recover', 'error-help'],
  argumentHint: '[error-code]',
  load: () => import('./oops.js'),
}

export default oops

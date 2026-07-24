import type { Command } from '../../commands.js'

const code = {
  type: 'local-jsx',
  name: 'code',
  aliases: ['accept'],
  description: 'Accept blinkplan.md and implement (code mode)',
  load: () => import('./code.js'),
} satisfies Command

export default code

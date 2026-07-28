import type { Command } from '../../commands.js'

const improve: Command = {
  type: 'local-jsx',
  name: 'improve',
  aliases: ['gpt-engineer-i'],
  description: 'gpt-engineer improve mode (-i) — iterate on existing code',
  argumentHint: '[goal]',
  load: () => import('./improve.impl.js'),
}

export default improve

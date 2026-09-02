import type { Command } from '../../commands.js'

const chain: Command = {
  type: 'local-jsx',
  name: 'chain',
  aliases: ['autogpt', 'autogpt-chain'],
  description: 'AutoGPT analyze → plan → act → reflect chain',
  argumentHint: '[goal]',
  load: () => import('./chain.impl.js'),
}

export default chain

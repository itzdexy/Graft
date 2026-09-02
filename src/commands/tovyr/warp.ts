import type { Command } from '../../commands.js'

const warp: Command = {
  type: 'local-jsx',
  name: 'warp',
  aliases: ['warp-blocks', 'run-blocks'],
  description: 'Warp-style multi-command block runner',
  argumentHint: 'preview <paste> | run <paste>',
  load: () => import('./warp.impl.js'),
}

export default warp

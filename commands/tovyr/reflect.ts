import type { Command } from '../../commands.js'

const reflect: Command = {
  type: 'local-jsx',
  name: 'reflect',
  aliases: ['autogpt-reflect'],
  description: 'AutoGPT reflect step — check output vs success criteria',
  argumentHint: '[what to reflect on]',
  load: () => import('./reflect.impl.js'),
}

export default reflect

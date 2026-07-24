import type { Command } from '../../commands.js'

const experiment: Command = {
  type: 'local-jsx',
  name: 'experiment',
  aliases: ['fork', 'opencode-fork'],
  description: 'OpenCode-style experiment forks (isolated tries)',
  argumentHint: 'new <label> | list | status | git | use <forkId>',
  load: () => import('./experiment.impl.js'),
}

export default experiment

import type { Command } from '../../commands.js'

const interpret: Command = {
  type: 'local-jsx',
  name: 'interpret',
  aliases: ['oi', 'open-interpreter'],
  description: 'Open Interpreter-style code execution via the agent',
  argumentHint: '<python|js|shell> <code…>',
  load: () => import('./interpret.impl.js'),
}

export default interpret

import type { Command } from '../../commands.js'

const auto = {
  type: 'local-jsx',
  name: 'auto',
  description: 'Enable classifier-guarded autonomous mode',
  load: () => import('./auto.js'),
} satisfies Command

export default auto

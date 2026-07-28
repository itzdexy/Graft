import type { Command } from '../../commands.js'

const plandex: Command = {
  type: 'local',
  name: 'plandex',
  description: 'Plandex — diff sandbox, plan versions, superthink',
  load: () => import('./plandex.impl.js'),
}

export default plandex

import type { Command } from '../../commands.js'

const continueDev: Command = {
  type: 'local',
  name: 'continue-dev',
  aliases: ['continue-rules'],
  description: 'Continue.dev — config fragment and rules sync',
  load: () => import('./continue-dev.impl.js'),
}

export default continueDev

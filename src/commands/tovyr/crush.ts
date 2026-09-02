import type { Command } from '../../commands.js'

const crush: Command = {
  type: 'local',
  name: 'crush',
  description: 'Crush-style compact TUI output mode',
  argumentHint: 'on | off | status | shortcuts',
  supportsNonInteractive: true,
  load: () => import('./crush.impl.js'),
}

export default crush

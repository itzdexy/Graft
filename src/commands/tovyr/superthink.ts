import type { Command } from '../../commands.js'

const superthink: Command = {
  type: 'local-jsx',
  name: 'superthink',
  description:
    'Superthinker mode — research, clarify via a localhost questionnaire, get plan sign-off, then build with a preview',
  argumentHint: 'on|off|status|go|continue <goal>|result <path>|help | <goal>',
  load: () => import('./superthink.impl.js'),
}

export default superthink

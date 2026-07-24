import type { Command } from '../../commands.js'

const mode = {
  type: 'local-jsx',
  name: 'mode',
  description: 'Show current permission mode and Blink mode commands',
  load: () => import('./mode.js'),
} satisfies Command

export default mode

import type { Command } from '../../commands.js'

const bypass = {
  type: 'local-jsx',
  name: 'bypass',
  description: 'Enable bypass mode (auto-accept all edits and commands)',
  load: () => import('./bypass.js'),
} satisfies Command

export default bypass

import type { Command } from '../../commands.js'

const safe = {
  type: 'local-jsx',
  name: 'safe',
  description: 'Safe mode — read-only tools, no shell (unknown repos)',
  load: () => import('./safe.js'),
} satisfies Command

export default safe

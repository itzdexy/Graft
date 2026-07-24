import type { Command } from '../../commands.js'

const plan = {
  type: 'local-jsx',
  name: 'plan',
  description: 'Plan mode — draft blinkplan.md, then /code to implement',
  argumentHint: '[open|<description>]',
  load: () => import('./plan.js'),
} satisfies Command

export default plan

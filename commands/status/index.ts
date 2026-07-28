import type { Command } from '../../commands.js'

const status = {
  type: 'local-jsx',
  name: 'status',
  description:
    'Show Tovyr status including version, model, account, API connectivity, and tool statuses',
  category: 'Core',
  immediate: true,
  load: () => import('./status.js'),
} satisfies Command

export default status

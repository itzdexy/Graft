import type { Command } from '../../commands.js'

const peers = {
  type: 'local-jsx',
  name: 'peers',
  description: 'List live local Tovyr sessions',
  load: () => import('./peers.js'),
} satisfies Command

export default peers

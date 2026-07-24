import type { Command } from '../../commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Blink Buddy - companion, tips, goals, and command guide',
  category: 'Memory',
  argumentHint: '[tip|pet|mute|unmute|remember <fact>|goal <goal>|done <n>|goals|decisions <fact>]',
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy

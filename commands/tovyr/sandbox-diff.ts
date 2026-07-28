import type { Command } from '../../commands.js'

const sandboxDiff: Command = {
  type: 'local',
  name: 'sandbox-diff',
  aliases: ['plandex-sandbox', 'diff-sandbox'],
  description: 'Plandex-style cumulative diff capture and review',
  argumentHint: 'status | capture | discard',
  supportsNonInteractive: true,
  load: () => import('./sandbox-diff.impl.js'),
}

export default sandboxDiff

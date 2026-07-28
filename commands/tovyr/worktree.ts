import type { Command } from '../../commands.js'

const worktree: Command = {
  type: 'local-jsx',
  name: 'worktree',
  aliases: ['openhands-worktree'],
  description: 'OpenHands-style git worktree isolation for fixes',
  argumentHint: 'new <name> | list | git <id-prefix>',
  load: () => import('./worktree.impl.js'),
}

export default worktree

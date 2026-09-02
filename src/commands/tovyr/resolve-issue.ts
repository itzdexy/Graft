import type { Command } from '../../commands.js'

const resolveIssue: Command = {
  type: 'local-jsx',
  name: 'resolve-issue',
  aliases: ['openhands-issue', 'gh-issue'],
  description: 'OpenHands-style GitHub issue resolver workflow',
  argumentHint: '<url|owner/repo#123>',
  load: () => import('./resolve-issue.impl.js'),
}

export default resolveIssue

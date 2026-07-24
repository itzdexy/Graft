import type { Command } from '../../commands.js'

const gitCommit: Command = {
  type: 'local',
  name: 'git-commit',
  aliases: ['aider-commit', 'commit-ai'],
  description: 'Aider-style git commit with blinkcode: prefix',
  argumentHint: '[summary message]',
  supportsNonInteractive: true,
  load: () => import('./git-commit.impl.js'),
}

export default gitCommit

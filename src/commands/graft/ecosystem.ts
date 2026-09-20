import type { Command } from '../../commands.js'

const ecosystem: Command = {
  type: 'local',
  name: 'ecosystem',
  aliases: ['upstream'],
  description:
    'Open-source agent ecosystem — Codex, Cline, Agent Reach, Claw Code, Gemini CLI, and more',
  argumentHint: '[list|coverage|status|<upstream-id>|template <id>|config continue]',
  supportsNonInteractive: true,
  load: () => import('./ecosystem.impl.js'),
}

export default ecosystem

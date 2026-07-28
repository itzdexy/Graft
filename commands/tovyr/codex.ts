import type { Command } from '../../commands.js'

const codex: Command = {
  type: 'local',
  name: 'codex',
  description: 'OpenAI Codex CLI — approval modes, AGENTS.md, execpolicy',
  load: () => import('./codex.impl.js'),
}

export default codex

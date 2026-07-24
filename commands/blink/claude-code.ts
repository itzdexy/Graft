import type { Command } from '../../commands.js'

const claudeCode: Command = {
  type: 'local',
  name: 'claude-code',
  description: 'Blink baseline — skills, MCP, plan/code, subagents',
  load: () => import('./claude-code.impl.js'),
}

export default claudeCode

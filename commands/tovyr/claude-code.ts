import type { Command } from '../../commands.js'

const capabilities: Command = {
  type: 'local',
  name: 'capabilities',
  description: 'Tovyr capabilities: skills, MCP, plan/code, and subagents',
  load: () => import('./claude-code.impl.js'),
}

export default capabilities

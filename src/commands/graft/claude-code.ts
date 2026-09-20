import type { Command } from '../../commands.js'

const capabilities: Command = {
  type: 'local',
  name: 'capabilities',
  description: 'Graft capabilities: skills, MCP, plan/code, and subagents',
  supportsNonInteractive: true,
  load: () => import('./claude-code.impl.js'),
}

export default capabilities

import type { Command } from '../../commands.js'

const gemini: Command = {
  type: 'local',
  name: 'gemini',
  aliases: ['gemini-cli'],
  description: 'Gemini CLI — @file context and MCP grounding',
  load: () => import('./gemini.impl.js'),
}

export default gemini

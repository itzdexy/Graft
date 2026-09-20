import type { Command } from '../../commands.js'

const expansion: Command = {
  type: 'local',
  name: 'expansion',
  aliases: ['features', 'world-class'],
  description:
    'World-class expansion features — adversary, BMAD, tasks, inference, MCP templates',
  argumentHint:
    'status | adversary | tasks | bmad <goal> | commands | think <problem> | catalog-refresh | mcp-templates | serve',
  supportsNonInteractive: true,
  load: () => import('./expansion.impl.js'),
}

export default expansion

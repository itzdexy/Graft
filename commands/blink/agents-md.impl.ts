import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LocalCommandCall } from '../../types/command.js'
import {
  discoverProjectContextFiles,
  generateAgentsMdTemplate,
} from '../../services/blink/context/agentsMd.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalCommandCall = async (args) => {
  const sub = args.trim().toLowerCase() || 'show'
  const cwd = getCwd()
  const agentsPath = join(cwd, 'AGENTS.md')

  if (sub === 'init' || sub === 'create') {
    if (existsSync(agentsPath)) {
      return {
        type: 'text',
        value:
          `\`AGENTS.md\` already exists at \`${agentsPath}\`.\n\nUse \`/init\` for AI-assisted improvements, or edit manually.`,
      }
    }
    writeFileSync(agentsPath, generateAgentsMdTemplate(cwd) + '\n', 'utf8')
    return {
      type: 'text',
      value: `Created starter \`AGENTS.md\` at \`${agentsPath}\`.\n\nRun \`/init\` to have Blink fill in architecture and gotchas.`,
    }
  }

  const files = discoverProjectContextFiles(cwd)
  const agents = files.find(f => f.path.endsWith('AGENTS.md'))
  if (agents) {
    return {
      type: 'text',
      value: `# ${agents.path}\n\n${agents.content}`,
    }
  }

  if (sub === 'template') {
    return { type: 'text', value: generateAgentsMdTemplate(cwd) }
  }

  return {
    type: 'text',
    value: [
      'No `AGENTS.md` in this project.',
      '',
      '- `/agents-md init` — write a Codex-compatible starter template',
      '- `/init` — AI survey and full AGENTS.md generation',
    ].join('\n'),
  }
}

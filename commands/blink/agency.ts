import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  formatAgencyList,
  installAgencyAgents,
  installAgencyDivision,
  installAllCuratedAgency,
} from '../../services/blink/integrations/agencyInstall.js'
import { findAgencyAgent } from '../../services/blink/integrations/agencyCatalog.js'

function formatResult(
  label: string,
  result: Awaited<ReturnType<typeof installAgencyAgents>>,
): string {
  const lines = [label]
  if (result.installed.length) {
    lines.push(`Installed ${result.installed.length} agent(s) → ${result.targetDir}`)
    lines.push(result.installed.map(s => `  - ${s}`).join('\n'))
  }
  if (result.failed.length) {
    lines.push('Failed:')
    for (const f of result.failed) {
      lines.push(`  - ${f.slug}: ${f.error}`)
    }
  }
  lines.push('')
  lines.push('Reload agents in Blink or restart the session to pick up new definitions.')
  return lines.join('\n')
}

const agency: Command = {
  type: 'prompt',
  name: 'agency',
  aliases: ['the-agency'],
  description: 'Install Agency agent personas from msitarzewski/agency-agents',
  argumentHint: '[list | install <slug> | install division <id> | install all]',
  progressMessage: 'installing agency agents',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args: string): Promise<ContentBlockParam[]> {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const sub = (parts[0] || 'list').toLowerCase()

    if (sub === 'list' || sub === 'help') {
      return [{ type: 'text', text: formatAgencyList() }]
    }

    if (sub === 'install') {
      const target = (parts[1] || '').toLowerCase()
      if (!target) {
        return [
          {
            type: 'text',
            text: 'Usage: /agency install <slug> | /agency install division <id> | /agency install all',
          },
        ]
      }
      if (target === 'all') {
        const result = await installAllCuratedAgency()
        return [{ type: 'text', text: formatResult('Curated Agency pack', result) }]
      }
      if (target === 'division') {
        const divId = parts[2]
        if (!divId) {
          return [{ type: 'text', text: 'Usage: /agency install division engineering|design|product|marketing|security' }]
        }
        const result = await installAgencyDivision(divId)
        return [{ type: 'text', text: formatResult(`Division ${divId}`, result) }]
      }
      if (!findAgencyAgent(target)) {
        return [
          {
            type: 'text',
            text: `Unknown agent "${target}". Run /agency list for slugs.`,
          },
        ]
      }
      const result = await installAgencyAgents([target])
      return [{ type: 'text', text: formatResult(target, result) }]
    }

    return [{ type: 'text', text: formatAgencyList() }]
  },
}

export default agency

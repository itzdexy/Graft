import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { getCwd } from '../../../utils/cwd.js'
import {
  AGENCY_DIVISIONS,
  agencyRawUrl,
  findAgencyAgent,
  listAgencySlugs,
} from './agencyCatalog.js'

export type AgencyInstallResult = {
  installed: string[]
  failed: Array<{ slug: string; error: string }>
  targetDir: string
}

async function fetchAgentMarkdown(division: string, slug: string): Promise<string> {
  const url = agencyRawUrl(division, slug)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return await res.text()
}

function agentFileName(slug: string): string {
  return `${slug}.md`
}

export async function installAgencyAgents(
  slugs: string[],
  cwd = getCwd(),
): Promise<AgencyInstallResult> {
  const targetDir = join(cwd, '.graft', 'agents')
  await mkdir(targetDir, { recursive: true })

  const installed: string[] = []
  const failed: AgencyInstallResult['failed'] = []

  for (const slug of slugs) {
    const meta = findAgencyAgent(slug)
    if (!meta) {
      failed.push({ slug, error: 'Unknown agent slug (see /agency list)' })
      continue
    }
    try {
      const body = await fetchAgentMarkdown(meta.division, slug)
      const dest = join(targetDir, agentFileName(slug))
      await writeFile(dest, body, 'utf8')
      installed.push(slug)
    } catch (err) {
      failed.push({
        slug,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { installed, failed, targetDir }
}

export async function installAgencyDivision(
  divisionId: string,
  cwd = getCwd(),
): Promise<AgencyInstallResult> {
  const div = AGENCY_DIVISIONS.find(d => d.id === divisionId)
  if (!div) {
    return {
      installed: [],
      failed: [{ slug: divisionId, error: 'Unknown division' }],
      targetDir: join(cwd, '.graft', 'agents'),
    }
  }
  return installAgencyAgents(
    div.agents.map(a => a.slug),
    cwd,
  )
}

export async function installAllCuratedAgency(cwd = getCwd()): Promise<AgencyInstallResult> {
  return installAgencyAgents(listAgencySlugs(), cwd)
}

export function formatAgencyList(): string {
  const lines: string[] = [
    '# The Agency (curated for Graft)',
    '',
    'Source: https://github.com/msitarzewski/agency-agents',
    '',
    'Install: `/agency install <slug>` or `/agency install division <id>`',
    '',
  ]
  for (const div of AGENCY_DIVISIONS) {
    lines.push(`## ${div.label} (\`${div.id}\`)`)
    for (const a of div.agents) {
      lines.push(`- \`${a.slug}\` — ${a.label}`)
    }
    lines.push('')
  }
  lines.push('Install all curated: `/agency install all`')
  return lines.join('\n')
}

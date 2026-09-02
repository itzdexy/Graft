import { ECOSYSTEM_UPSTREAMS } from './catalog.js'
import {
  getUpstreamHelp,
  isUpstreamId,
  UPSTREAM_ENTRY_POINTS,
} from './upstreamHelp.js'
import type { EcosystemUpstreamId } from './types.js'

export type UpstreamCoverageRow = {
  id: EcosystemUpstreamId
  name: string
  skill: string | undefined
  features: number
  entryPoints: string[]
  hooks: string[]
}

export function auditUpstreamCoverage(): { ok: boolean; gaps: string[] } {
  const gaps: string[] = []

  // Blurb skills are no longer registered; an upstream is covered by its
  // entry points and help text, not by a skill id.
  for (const u of ECOSYSTEM_UPSTREAMS) {
    const entry = UPSTREAM_ENTRY_POINTS[u.id]
    if (!entry?.length) {
      gaps.push(`${u.id}: no entry points in UPSTREAM_ENTRY_POINTS`)
    }

    if (!getUpstreamHelp(u.id).trim()) {
      gaps.push(`${u.id}: empty upstream help`)
    }

    if (u.features.length === 0) {
      gaps.push(`${u.id}: no catalog features`)
    }

    for (const f of u.features) {
      if (!f.tovyrHook) {
        gaps.push(`${u.id}/${f.id}: feature missing tovyrHook`)
      }
    }
  }

  if (ECOSYSTEM_UPSTREAMS.length !== 14) {
    gaps.push(`expected 14 upstreams, got ${ECOSYSTEM_UPSTREAMS.length}`)
  }

  return { ok: gaps.length === 0, gaps }
}

export function listUpstreamCoverageRows(): UpstreamCoverageRow[] {
  return ECOSYSTEM_UPSTREAMS.map(u => ({
    id: u.id,
    name: u.name,
    skill: u.skill,
    features: u.features.length,
    entryPoints: UPSTREAM_ENTRY_POINTS[u.id] ?? [],
    hooks: u.features.map(f => f.tovyrHook).filter((h): h is string => !!h),
  }))
}

export function formatUpstreamCoverage(): string {
  const audit = auditUpstreamCoverage()
  const rows = listUpstreamCoverageRows()
  const lines = [
    '# Ecosystem upstream coverage',
    '',
    audit.ok
      ? `✓ All **${rows.length}** open-source repos have skills, entry points, hooks, and help text.`
      : `⚠ **${audit.gaps.length}** gap(s) — run tests or fix catalog:\n${audit.gaps.map(g => `- ${g}`).join('\n')}`,
    '',
  ]

  for (const row of rows) {
    lines.push(`## ${row.name} (\`${row.id}\`)`)
    lines.push(`Skill: \`/skill ${row.skill ?? '—'}\` · ${row.features} features`)
    lines.push('')
    lines.push('**Entry points:** ' + row.entryPoints.map(e => `\`${e}\``).join(' · '))
    lines.push('')
    lines.push('**Hooks:**')
    for (const h of row.hooks) {
      lines.push(`- \`${h}\``)
    }
    lines.push('')
  }

  lines.push('Use `/ecosystem <upstream-id>` or the dedicated shortcut (e.g. `/codex`) for repo-specific help.')
  return lines.join('\n')
}

export function resolveUpstreamHelpArg(arg: string): string | null {
  const id = arg.toLowerCase()
  if (!isUpstreamId(id)) return null
  return getUpstreamHelp(id)
}

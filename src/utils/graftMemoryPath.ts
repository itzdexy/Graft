import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Reuse existing instructions in place; never copy or overwrite user content. */
export function graftMemoryPath(directory: string, local = false): string {
  const names = local
    ? ['graft.local.md', 'tovyr.local.md', 'CLAUDE.local.md']
    : ['graft.md', 'tovyr.md', 'CLAUDE.md']
  return names.map(name => join(directory, name)).find(existsSync)
    ?? join(directory, names[0]!)
}

export function graftPlanPath(directory: string): string {
  const preferred = join(directory, 'graftplan.md')
  const legacy = join(directory, 'tovyrplan.md')
  return !existsSync(preferred) && existsSync(legacy) ? legacy : preferred
}

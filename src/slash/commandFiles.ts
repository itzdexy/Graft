/**
 * Command files with stable IDs (OpenCode pattern).
 * Stored under .graft/commands/*.md with YAML frontmatter.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export interface CommandFile {
  id: string
  name: string
  description: string
  body: string
  path: string
  version: number
  tags: string[]
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

function parseFrontmatter(raw: string): {
  meta: Record<string, string>
  body: string
} {
  const m = raw.match(FRONTMATTER_RE)
  if (!m) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of m[1]!.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) meta[kv[1]!] = kv[2]!.replace(/^["']|["']$/g, '')
  }
  return { meta, body: m[2]!.trim() }
}

function stableId(name: string, body: string): string {
  return createHash('sha256').update(`${name}\n${body}`).digest('hex').slice(0, 12)
}

export function getCommandsDir(cwd: string): string {
  return join(cwd, '.graft', 'commands')
}

export function loadCommandFiles(cwd: string): CommandFile[] {
  const dir = getCommandsDir(cwd)
  if (!existsSync(dir)) return []
  const files: CommandFile[] = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue
    const path = join(dir, name)
    try {
      const raw = readFileSync(path, 'utf8')
      const { meta, body } = parseFrontmatter(raw)
      const cmdName = meta.name ?? name.replace(/\.md$/, '')
      files.push({
        id: meta.id ?? stableId(cmdName, body),
        name: cmdName,
        description: meta.description ?? '',
        body,
        path,
        version: Number(meta.version ?? 1),
        tags: meta.tags ? meta.tags.split(',').map(t => t.trim()) : [],
      })
    } catch {
      // skip unreadable
    }
  }
  return files
}

export function findCommandById(
  cwd: string,
  id: string,
): CommandFile | undefined {
  return loadCommandFiles(cwd).find(c => c.id === id || c.name === id)
}

export function saveCommandFile(
  cwd: string,
  cmd: Pick<CommandFile, 'name' | 'description' | 'body' | 'tags'> & {
    id?: string
    version?: number
  },
): CommandFile {
  const dir = getCommandsDir(cwd)
  mkdirSync(dir, { recursive: true })
  const id = cmd.id ?? stableId(cmd.name, cmd.body)
  const version = cmd.version ?? 1
  const path = join(dir, `${cmd.name}.md`)
  const content = [
    '---',
    `id: ${id}`,
    `name: ${cmd.name}`,
    `description: ${cmd.description}`,
    `version: ${version}`,
    cmd.tags.length ? `tags: ${cmd.tags.join(', ')}` : '',
    '---',
    '',
    cmd.body,
  ]
    .filter(Boolean)
    .join('\n')
  writeFileSync(path, content, 'utf8')
  return {
    id,
    name: cmd.name,
    description: cmd.description,
    body: cmd.body,
    path,
    version,
    tags: cmd.tags,
  }
}

export function formatCommandFileList(cwd: string): string {
  const cmds = loadCommandFiles(cwd)
  if (!cmds.length) {
    return 'No command files in `.graft/commands/`. Add `*.md` with YAML frontmatter (id, name, description).'
  }
  return cmds
    .map(c => `- \`${c.id}\` **/${c.name}** — ${c.description || '(no description)'}`)
    .join('\n')
}

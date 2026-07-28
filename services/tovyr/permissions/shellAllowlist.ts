/** Shell command prefixes allowed in Tovyr full-auto without prompting. */
export const TOVYR_SHELL_ALLOWLIST = new Set([
  'ls',
  'dir',
  'cat',
  'type',
  'head',
  'tail',
  'pwd',
  'cd',
  'echo',
  'rg',
  'grep',
  'find',
  'git',
  'gh',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'node',
  'python',
  'python3',
  'py',
  'pip',
  'cargo',
  'go',
  'make',
  'pytest',
  'vitest',
  'jest',
  'tsc',
  'eslint',
  'prettier',
  'deno',
  'dotnet',
  'mvn',
  'gradle',
  'which',
  'where',
  'whoami',
  'uname',
  'date',
  'wc',
  'sort',
  'uniq',
  'diff',
  'jq',
])

export function shellCommandBase(command: string): string | null {
  const trimmed = command.trim()
  if (!trimmed) return null
  const first = trimmed.split(/\s+/)[0]
  if (!first) return null
  const base =
    first.replace(/^[("'`](.+)[)"'`]$/, '$1').split(/[/\\]/).pop() ?? first
  return base.replace(/\.exe$/i, '')
}

export function isShellAllowlisted(command: string): boolean {
  const base = shellCommandBase(command)
  if (!base) return false
  return TOVYR_SHELL_ALLOWLIST.has(base.toLowerCase())
}

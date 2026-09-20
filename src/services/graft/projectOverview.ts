import { lstat, opendir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { execFileNoThrowWithCwd } from '../../utils/execFileNoThrow.js'
import { gitExe } from '../../utils/git.js'
import { detectPackageManager } from './verify/projectScripts.js'

export type ProjectOverview = {
  name: string
  stack: string[]
  entries: string[]
  truncated: boolean
  checks: string[]
  git: { branch: string; staged: number; modified: number; untracked: number; conflicts: number } | null
}

export function parseOverviewGitStatus(raw: string): NonNullable<ProjectOverview['git']> {
  const result = { branch: 'unknown', staged: 0, modified: 0, untracked: 0, conflicts: 0 }
  const records = raw.split('\0')
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!
    if (record.startsWith('## ')) {
      result.branch = record.slice(3).replace(/^(?:No commits yet on |Initial commit on )/, '').split('...')[0]!
      continue
    }
    if (record.length < 3) continue
    const status = record.slice(0, 2)
    if (status === '??') { result.untracked++; continue }
    if (status === '!!') continue
    if (/^(?:DD|AU|UD|UA|DU|AA|UU)$/.test(status)) result.conflicts++
    else {
      if (status[0] !== ' ') result.staged++
      if (status[1] !== ' ') result.modified++
    }
    // Porcelain -z puts the original path in a separate record for renames.
    if (/[RC]/.test(status)) i++
  }
  return result
}

/** Read only top-level metadata; never scan source bodies or invoke project scripts. */
export async function getProjectOverview(cwd: string): Promise<ProjectOverview> {
  const names = new Set<string>()
  const entries: string[] = []
  let scanned = 0
  let truncated = false
  const directory = await opendir(cwd)
  for await (const entry of directory) {
    if (++scanned > 256) { truncated = true; break }
    if (entry.isSymbolicLink()) continue
    names.add(entry.name)
    if (entry.name.startsWith('.') || ['node_modules', 'vendor', 'dist', 'build', 'coverage'].includes(entry.name)) continue
    entries.push(entry.name + (entry.isDirectory() ? '/' : ''))
  }
  entries.sort((a, b) => a.localeCompare(b))
  const stack: string[] = []
  const checks: string[] = []
  if (names.has('package.json')) {
    stack.push('JavaScript / Node.js')
    try {
      const manifestPath = join(cwd, 'package.json')
      const stat = await lstat(manifestPath)
      if (stat.isFile() && stat.size <= 131072) {
        const pkg = JSON.parse(await readFile(manifestPath, 'utf8'))
        const dependencies = { ...pkg.dependencies, ...pkg.devDependencies }
        for (const [dependency, label] of Object.entries({ typescript: 'TypeScript', react: 'React', next: 'Next.js', vue: 'Vue', svelte: 'Svelte', astro: 'Astro', electron: 'Electron', express: 'Express' })) {
          if (typeof dependencies[dependency] === 'string') stack.push(label)
        }
        const pm = detectPackageManager(cwd)
        for (const script of ['dev', 'test', 'lint', 'typecheck', 'build']) {
          if (typeof pkg.scripts?.[script] === 'string' && pkg.scripts[script].trim()) checks.push(`${pm} run ${script}`)
        }
      }
    } catch { /* A broken manifest should not hide the folder overview. */ }
  }
  if (names.has('Cargo.toml')) stack.push('Rust')
  if (names.has('go.mod')) stack.push('Go')
  if (names.has('pyproject.toml') || names.has('requirements.txt') || names.has('setup.py')) stack.push('Python')
  const status = await execFileNoThrowWithCwd(gitExe(), ['--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain=v1', '--branch', '-z', '--untracked-files=normal', '--ignore-submodules=all', '--', '.'], { cwd, timeout: 2000, maxBuffer: 1_000_000, stdin: 'ignore' })
  return { name: basename(cwd), stack, entries: entries.slice(0, 14), truncated: truncated || entries.length > 14, checks, git: status.code === 0 ? parseOverviewGitStatus(status.stdout) : null }
}

export function formatProjectOverview(project: ProjectOverview): string {
  const git = project.git
  return [
    `Project ${JSON.stringify(project.name)}`,
    project.stack.length ? project.stack.join(' · ') : 'No recognized root manifest',
    git ? `Git ${JSON.stringify(git.branch)} · ${git.staged} staged · ${git.modified} modified · ${git.untracked} untracked entries · ${git.conflicts} conflicts` : 'Git status unavailable or this folder is not a repository',
    '',
    `Files: ${project.entries.map(entry => JSON.stringify(entry)).join('  ') || '(none to show)'}${project.truncated ? '  …' : ''}`,
    `Scripts: ${project.checks.join(' · ') || 'No standard package scripts detected'}`,
    '',
    '/repo map <topic> for focused context · /verify for checks · /review for changes',
  ].join('\n')
}

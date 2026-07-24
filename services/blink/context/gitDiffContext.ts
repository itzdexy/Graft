import { spawnSync } from 'node:child_process'
import { getCwd } from '../../../utils/cwd.js'
import { gitExe } from '../../../utils/git.js'
import { isBlinkRuntime } from '../../../utils/blinkRuntime.js'
import { parseShortstat } from '../../../utils/gitDiff.js'

const GIT_TIMEOUT_MS = 4000
const MAX_FILE_LINES = 40

function runGit(args: string[], cwd: string): string | null {
  try {
    const result = spawnSync(gitExe(), args, {
      cwd,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
    })
    if (result.status !== 0) return null
    return result.stdout?.trim() || ''
  } catch {
    return null
  }
}

/** Lightweight sync git diff summary for system prompts (no hunks). */
export function loadGitDiffSectionSync(cwd = getCwd()): string | null {
  if (!isBlinkRuntime()) return null
  if (process.env.BLINK_GIT_DIFF === '0') return null

  const inside = runGit(['rev-parse', '--is-inside-work-tree'], cwd)
  if (inside !== 'true') return null

  const shortstatOut = runGit(
    ['--no-optional-locks', 'diff', 'HEAD', '--shortstat'],
    cwd,
  )
  const stats = shortstatOut ? parseShortstat(shortstatOut) : null
  if (!stats || stats.filesCount === 0) {
    const untracked = runGit(
      ['--no-optional-locks', 'ls-files', '--others', '--exclude-standard'],
      cwd,
    )
    if (!untracked) return null
    const files = untracked.split(/\r?\n/).filter(Boolean)
    if (files.length === 0) return null
    const listed = files.slice(0, MAX_FILE_LINES)
    const lines = [
      '# Git working tree (untracked only)',
      '',
      `${files.length} untracked file(s). Review before committing.`,
      '',
      ...listed.map(f => `- ${f}`),
    ]
    if (files.length > MAX_FILE_LINES) {
      lines.push(`- … and ${files.length - MAX_FILE_LINES} more`)
    }
    return lines.join('\n')
  }

  const nameOut = runGit(
    ['--no-optional-locks', 'diff', 'HEAD', '--name-only'],
    cwd,
  )
  const files = nameOut ? nameOut.split(/\r?\n/).filter(Boolean) : []
  const listed = files.slice(0, MAX_FILE_LINES)

  const lines = [
    '# Git working tree (uncommitted vs HEAD)',
    '',
    `${stats.filesCount} file(s), +${stats.linesAdded} / -${stats.linesRemoved} lines.`,
    'Prefer reviewing these paths before broad refactors.',
    '',
    ...listed.map(f => `- ${f}`),
  ]
  if (files.length > MAX_FILE_LINES) {
    lines.push(`- … and ${files.length - MAX_FILE_LINES} more`)
  }
  return lines.join('\n')
}

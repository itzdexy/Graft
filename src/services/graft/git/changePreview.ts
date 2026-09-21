import { execFileNoThrowWithCwd } from '../../../utils/execFileNoThrow.js'
import { gitExe } from '../../../utils/git.js'

type LineCount = { added: number; removed: number } | 'binary'

function parseCounts(output: string): Map<string, LineCount> {
  const counts = new Map<string, LineCount>()
  for (const record of output.split('\0')) {
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(record)
    if (match) counts.set(match[3]!, match[1] === '-' || match[2] === '-'
      ? 'binary' : { added: Number(match[1]), removed: Number(match[2]) })
  }
  return counts
}

function formatCount(label: string, count?: LineCount): string {
  return !count ? '' : count === 'binary' ? `${label}: binary` : `${label}: +${count.added}/-${count.removed}`
}

/** Bounded metadata only: never read patch bodies or invoke external diff programs. */
export async function getChangePreview(cwd: string): Promise<string> {
  const rootResult = await execFileNoThrowWithCwd(gitExe(), ['rev-parse', '--show-toplevel'], { cwd, timeout: 3000 })
  if (rootResult.code !== 0 || !rootResult.stdout.trim()) return 'No Git working tree is available in this folder.'
  const root = rootResult.stdout.trim()
  const read = (args: string[]) => execFileNoThrowWithCwd(gitExe(), ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], { cwd: root, timeout: 3000, maxBuffer: 1_000_000, stdin: 'ignore' })
  const [status, staged, working] = await Promise.all([
    read(['status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=normal']),
    read(['diff', '--cached', '--numstat', '-z', '--no-renames', '--no-ext-diff', '--no-textconv']),
    read(['diff', '--numstat', '-z', '--no-renames', '--no-ext-diff', '--no-textconv']),
  ])
  if ([status, staged, working].some(result => result.code !== 0)) return 'Git change preview is unavailable or exceeded its time/output limit. Run git status to inspect this repository.'
  const records = status.stdout.split('\0').filter(record => record.length > 3)
  if (!records.length) return 'Working tree clean. No pending Git changes.'
  const stagedCounts = parseCounts(staged.stdout)
  const workingCounts = parseCounts(working.stdout)
  return [
    `Changes · ${records.length} entries · whole repository`,
    'Columns: staged / working tree · M modified, A added, D deleted, ? untracked, U conflict',
    '',
    ...records.slice(0, 40).map(record => {
      const path = record.slice(3)
      return [record.slice(0, 2), JSON.stringify(path), formatCount('staged', stagedCounts.get(path)), formatCount('working', workingCounts.get(path))].filter(Boolean).join('  ')
    }),
    records.length > 40 ? `… ${records.length - 40} more entries. Use git status for the full list.` : '',
    '',
    'Untracked directories are grouped; their line counts are not included.',
    '/review for code review · /git-commit commits only what you have staged',
  ].filter(line => line !== undefined).join('\n')
}

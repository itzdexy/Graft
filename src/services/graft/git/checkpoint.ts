import { execFileNoThrowWithCwd } from '../../../utils/execFileNoThrow.js'
import { gitExe } from '../../../utils/git.js'

export const GRAFT_COMMIT_PREFIX = 'graftcode: '

export async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await execFileNoThrowWithCwd(gitExe(), ['rev-parse', '--is-inside-work-tree'], { cwd, timeout: 15_000 })
  return result.code === 0 && result.stdout.trim() === 'true'
}

/** Commit only the selection the user has staged, without sweeping in other work. */
export async function commitGraftChanges(cwd: string, summary: string): Promise<{ ok: boolean; message: string }> {
  if (!(await isGitRepo(cwd))) return { ok: false, message: 'Not a git repository.' }
  const staged = await execFileNoThrowWithCwd(gitExe(), ['diff', '--cached', '--quiet', '--exit-code', '--no-ext-diff'], { cwd, timeout: 15_000 })
  if (staged.code === 0) return { ok: false, message: 'Nothing staged. Use /changes to review, then stage the files you want to commit.' }
  if (staged.code !== 1) return { ok: false, message: 'Could not inspect staged changes. Nothing was committed.' }
  const msg = `${GRAFT_COMMIT_PREFIX}${summary.slice(0, 200)}`
  const commit = await execFileNoThrowWithCwd(gitExe(), ['commit', '-m', msg], { cwd, timeout: 60_000 })
  return commit.code === 0
    ? { ok: true, message: `Committed staged changes: ${msg}` }
    : { ok: false, message: commit.stderr || commit.stdout || 'git commit failed' }
}

type UndoPreview = { ok: boolean; message: string; head?: string }

/** Preview is read-only and identifies the exact commit eligible for a revert. */
export async function previewLastGraftCommit(cwd: string): Promise<UndoPreview> {
  if (!(await isGitRepo(cwd))) return { ok: false, message: 'Not a git repository.' }
  const log = await execFileNoThrowWithCwd(gitExe(), ['log', '-1', '--format=%H%n%P%n%s'], { cwd, timeout: 15_000 })
  if (log.code !== 0) return { ok: false, message: 'No commit is available to undo.' }
  const [head, parents, subject] = log.stdout.trimEnd().split('\n').map(s => s.replace(/\r$/, ''))
  if (!head || !subject?.startsWith(GRAFT_COMMIT_PREFIX)) return { ok: false, message: 'The latest commit is not a graftcode: commit.' }
  if (!parents || parents.split(' ').length !== 1) return { ok: false, message: 'Root and merge commits require a manual Git review.' }
  const status = await execFileNoThrowWithCwd(gitExe(), ['--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain', '--untracked-files=normal'], { cwd, timeout: 15_000 })
  if (status.code !== 0) return { ok: false, message: 'Could not inspect the working tree. Nothing was changed.' }
  if (status.stdout.trim()) return { ok: false, message: 'Commit or set aside your pending changes before Git undo. Use /changes to inspect them.' }
  const stat = await execFileNoThrowWithCwd(gitExe(), ['-c', 'color.ui=false', '-c', 'core.quotePath=true', 'show', '--format=', '--stat=80,40,20', '--no-ext-diff', '--no-textconv', head], { cwd, timeout: 15_000, maxBuffer: 65536 })
  if (stat.code !== 0) return { ok: false, message: 'Could not preview this commit. Nothing was changed.' }
  return { ok: true, head, message: [
    `Undo preview · ${head.slice(0, 12)}`,
    JSON.stringify(subject),
    stat.stdout.trim(),
    'This creates a new revert commit and preserves existing history.',
    `Apply: /undo git apply ${head}`,
  ].join('\n') }
}

export async function undoLastGraftCommit(cwd: string, expectedHead?: string): Promise<{ ok: boolean; message: string }> {
  const preview = await previewLastGraftCommit(cwd)
  if (!preview.ok || !expectedHead) return preview
  if (preview.head !== expectedHead) return { ok: false, message: 'The latest commit changed. Run /undo git again to review it.' }
  // Revert preserves history, unlike reset --hard, and Git refuses conflicting edits.
  const result = await execFileNoThrowWithCwd(gitExe(), ['revert', '--no-edit', expectedHead], { cwd, timeout: 60_000 })
  return result.code === 0
    ? { ok: true, message: `Created a revert commit for ${expectedHead.slice(0, 12)}. Existing history was preserved.` }
    : { ok: false, message: `Git revert did not complete. Inspect git status before continuing.\n${result.stderr || result.stdout}` }
}

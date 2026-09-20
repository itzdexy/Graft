import { execFileNoThrowWithCwd } from '../../../utils/execFileNoThrow.js'
import { gitExe } from '../../../utils/git.js'

export const GRAFT_COMMIT_PREFIX = 'graftcode: '

export async function isGitRepo(cwd: string): Promise<boolean> {
  const { code } = await execFileNoThrowWithCwd(
    gitExe(),
    ['rev-parse', '--is-inside-work-tree'],
    { cwd, timeout: 15_000 },
  )
  return code === 0
}

export async function hasUncommittedChanges(cwd: string): Promise<boolean> {
  const { stdout, code } = await execFileNoThrowWithCwd(
    gitExe(),
    ['status', '--porcelain'],
    { cwd, timeout: 30_000 },
  )
  return code === 0 && stdout.trim().length > 0
}

/** Stash or stage a checkpoint before the first edit in a turn. */
export async function createEditCheckpoint(cwd: string): Promise<{
  ok: boolean
  message: string
}> {
  if (!(await isGitRepo(cwd))) {
    return { ok: false, message: 'Not a git repository — skipping checkpoint.' }
  }
  if (!(await hasUncommittedChanges(cwd))) {
    return { ok: true, message: 'Working tree clean — no checkpoint needed.' }
  }

  const stash = await execFileNoThrowWithCwd(
    gitExe(),
    ['stash', 'push', '-u', '-m', 'graft-checkpoint'],
    { cwd, timeout: 60_000 },
  )
  if (stash.code === 0) {
    return { ok: true, message: 'Stashed uncommitted changes (graft-checkpoint).' }
  }

  const add = await execFileNoThrowWithCwd(
    gitExe(),
    ['add', '-A'],
    { cwd, timeout: 60_000 },
  )
  if (add.code !== 0) {
    return {
      ok: false,
      message: `Checkpoint failed: ${stash.stderr || stash.stdout || add.stderr}`,
    }
  }
  return { ok: true, message: 'Staged working tree before edits.' }
}

export async function commitGraftChanges(
  cwd: string,
  summary: string,
): Promise<{ ok: boolean; message: string }> {
  if (!(await isGitRepo(cwd))) {
    return { ok: false, message: 'Not a git repository.' }
  }
  if (!(await hasUncommittedChanges(cwd))) {
    return { ok: true, message: 'Nothing to commit.' }
  }

  await execFileNoThrowWithCwd(gitExe(), ['add', '-A'], {
    cwd,
    timeout: 60_000,
  })
  const msg = `${GRAFT_COMMIT_PREFIX}${summary.slice(0, 200)}`
  const commit = await execFileNoThrowWithCwd(
    gitExe(),
    ['commit', '-m', msg],
    { cwd, timeout: 60_000 },
  )
  if (commit.code !== 0) {
    return {
      ok: false,
      message: commit.stderr || commit.stdout || 'git commit failed',
    }
  }
  return { ok: true, message: `Committed: ${msg}` }
}

export async function lastCommitIsGraft(cwd: string): Promise<boolean> {
  const { stdout, code } = await execFileNoThrowWithCwd(
    gitExe(),
    ['log', '-1', '--format=%s'],
    { cwd, timeout: 15_000 },
  )
  return code === 0 && stdout.trim().startsWith(GRAFT_COMMIT_PREFIX)
}

export async function undoLastGraftCommit(cwd: string): Promise<{
  ok: boolean
  message: string
}> {
  if (!(await isGitRepo(cwd))) {
    return { ok: false, message: 'Not a git repository.' }
  }
  if (!(await lastCommitIsGraft(cwd))) {
    return {
      ok: false,
      message: `Last commit is not a ${GRAFT_COMMIT_PREFIX} commit — refusing to reset.`,
    }
  }
  const reset = await execFileNoThrowWithCwd(
    gitExe(),
    ['reset', '--hard', 'HEAD~1'],
    { cwd, timeout: 30_000 },
  )
  if (reset.code !== 0) {
    return {
      ok: false,
      message: reset.stderr || reset.stdout || 'git reset failed',
    }
  }
  return { ok: true, message: 'Reverted last graftcode commit (HEAD~1).' }
}

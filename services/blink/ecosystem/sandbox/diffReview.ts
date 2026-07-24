import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileNoThrowWithCwd } from '../../../../utils/execFileNoThrow.js'
import { gitExe } from '../../../../utils/git.js'

const SANDBOX_DIR = '.blink/ecosystem/sandbox'

export type SandboxDiffStatus = {
  sandboxRoot: string
  hasPendingDiff: boolean
  diffStat: string
  patchPath: string
}

function sandboxRoot(cwd: string): string {
  return join(cwd, SANDBOX_DIR)
}

function patchPath(cwd: string): string {
  return join(sandboxRoot(cwd), 'pending.patch')
}

function metaPath(cwd: string): string {
  return join(sandboxRoot(cwd), 'meta.json')
}

export function ensureSandboxDir(cwd: string): string {
  const root = sandboxRoot(cwd)
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  return root
}

/** Capture current git diff into Plandex-style sandbox (does not apply). */
export async function captureSandboxDiff(cwd: string): Promise<{
  ok: boolean
  message: string
  status?: SandboxDiffStatus
}> {
  ensureSandboxDir(cwd)
  const diff = await execFileNoThrowWithCwd(
    cwd,
    gitExe(),
    ['diff', 'HEAD'],
    { timeout: 120_000 },
  )
  if (diff.code !== 0) {
    return { ok: false, message: diff.stderr || 'git diff failed' }
  }
  const body = diff.stdout
  if (!body.trim()) {
    return { ok: true, message: 'No diff vs HEAD — sandbox empty.' }
  }
  writeFileSync(patchPath(cwd), body, 'utf8')
  const stat = await execFileNoThrowWithCwd(
    cwd,
    gitExe(),
    ['diff', '--stat', 'HEAD'],
    { timeout: 60_000 },
  )
  writeFileSync(
    metaPath(cwd),
    JSON.stringify({ capturedAt: new Date().toISOString() }, null, 2),
    'utf8',
  )
  return {
    ok: true,
    message: 'Diff captured to sandbox. Review with `/sandbox-diff status`.',
    status: {
      sandboxRoot: sandboxRoot(cwd),
      hasPendingDiff: true,
      diffStat: stat.stdout.trim(),
      patchPath: patchPath(cwd),
    },
  }
}

export function getSandboxDiffStatus(cwd: string): SandboxDiffStatus {
  const patch = patchPath(cwd)
  const has = existsSync(patch) && readFileSync(patch, 'utf8').trim().length > 0
  let diffStat = ''
  if (has) {
    try {
      diffStat = readFileSync(patch, 'utf8').split('\n').length + ' lines in patch'
    } catch {
      diffStat = 'patch present'
    }
  }
  return {
    sandboxRoot: sandboxRoot(cwd),
    hasPendingDiff: has,
    diffStat,
    patchPath: patch,
  }
}

export async function discardSandboxDiff(cwd: string): Promise<string> {
  const patch = patchPath(cwd)
  if (!existsSync(patch)) return 'Sandbox already empty.'
  writeFileSync(patch, '', 'utf8')
  return 'Discarded sandbox patch metadata (working tree unchanged).'
}

export function readSandboxPatch(cwd: string): string | null {
  const p = patchPath(cwd)
  if (!existsSync(p)) return null
  const body = readFileSync(p, 'utf8')
  return body.trim() ? body : null
}

export function formatSandboxStatus(cwd: string): string {
  const s = getSandboxDiffStatus(cwd)
  if (!s.hasPendingDiff) {
    return 'Plandex-style sandbox: **empty**. Run `/sandbox-diff capture` after AI edits to snapshot diff for review.'
  }
  const preview = readSandboxPatch(cwd)?.slice(0, 2000) ?? ''
  return [
    '# Sandbox diff review',
    '',
    `Root: \`${s.sandboxRoot}\``,
    `Patch: \`${s.patchPath}\``,
    `Summary: ${s.diffStat}`,
    '',
    '## Preview (first 2k chars)',
    '```diff',
    preview,
    preview.length >= 2000 ? '\n…' : '',
    '```',
    '',
    'Working tree already contains these edits. Use `/git-commit` when satisfied, or `git checkout -- .` to revert.',
  ].join('\n')
}

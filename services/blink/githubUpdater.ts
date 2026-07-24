import { spawn } from 'node:child_process'
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

export const BLINK_GITHUB_REPOSITORY = 'itsdexy/BlinkCode'
const REVISION_FILE = '.blink-github-revision'
const CHECK_TIMEOUT_MS = 8_000

export type BlinkUpdate = {
  sha: string
  shortSha: string
  title: string
  url: string
}

type GitHubCommit = {
  sha?: unknown
  html_url?: unknown
  commit?: {
    message?: unknown
  }
}

export function getBlinkRuntimeRoot(): string | null {
  const configured = process.env.BLINK_PACKAGE_ROOT || process.env.BLINK_SRC
  if (!configured) return null
  return resolve(configured)
}

export function isInstalledBlinkRuntime(root = getBlinkRuntimeRoot()): boolean {
  if (!root) return false
  const normalized = root.replaceAll('/', '\\').toLowerCase()
  return normalized.includes('\\blink\\runtime\\')
}

export function parseGitHubCommit(value: GitHubCommit): BlinkUpdate {
  if (typeof value.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(value.sha)) {
    throw new Error('GitHub returned an invalid Blink revision.')
  }
  const message =
    typeof value.commit?.message === 'string'
      ? value.commit.message.split(/\r?\n/, 1)[0]?.trim()
      : ''
  return {
    sha: value.sha,
    shortSha: value.sha.slice(0, 7),
    title: message || 'Blink update',
    url:
      typeof value.html_url === 'string'
        ? value.html_url
        : `https://github.com/${BLINK_GITHUB_REPOSITORY}/commit/${value.sha}`,
  }
}

async function fetchLatestCommit(): Promise<BlinkUpdate> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
  timer.unref?.()
  try {
    const response = await fetch(
      `https://api.github.com/repos/${BLINK_GITHUB_REPOSITORY}/commits/main`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'BlinkCode-Updater/1.0',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: controller.signal,
      },
    )
    if (!response.ok) {
      throw new Error(`GitHub update check failed (${response.status}).`)
    }
    return parseGitHubCommit((await response.json()) as GitHubCommit)
  } finally {
    clearTimeout(timer)
  }
}

export async function checkForBlinkUpdate(): Promise<BlinkUpdate | null> {
  const root = getBlinkRuntimeRoot()
  if (!isInstalledBlinkRuntime(root) || !root) return null

  const latest = await fetchLatestCommit()
  const revisionPath = join(root, REVISION_FILE)
  let installedRevision = ''
  try {
    installedRevision = (await readFile(revisionPath, 'utf8')).trim()
  } catch {
    // An installer built before GitHub updates has no baseline. The current
    // remote commit becomes its baseline; subsequent commits are announced.
    await writeFile(revisionPath, `${latest.sha}\n`, 'utf8')
    return null
  }
  return installedRevision === latest.sha ? null : latest
}

function run(command: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${basename(command)} exited with code ${code}.`))
    })
  })
}

async function findArchiveRoot(extractDir: string): Promise<string> {
  const entries = await readdir(extractDir, { withFileTypes: true })
  const folders = entries.filter(entry => entry.isDirectory())
  if (folders.length !== 1) {
    throw new Error('The Blink update archive has an unexpected layout.')
  }
  return join(extractDir, folders[0]!.name)
}

async function validateRuntime(root: string): Promise<void> {
  await Promise.all([
    access(join(root, 'entrypoints', 'cli.tsx')),
    access(join(root, 'bin', 'blink.ps1')),
    access(join(root, 'package.json')),
    stat(join(root, 'bun.lock')),
  ])
}

function bundledBun(): string {
  const installRoot = process.env.BUN_INSTALL
  if (installRoot) {
    return join(installRoot, 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun')
  }
  return process.execPath.toLowerCase().includes('bun') ? process.execPath : 'bun'
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

export async function prepareBlinkUpdate(update: BlinkUpdate): Promise<void> {
  const root = getBlinkRuntimeRoot()
  if (!isInstalledBlinkRuntime(root) || !root) {
    throw new Error('Blink self-update is available only for installer builds.')
  }

  const parent = dirname(root)
  const work = join(parent, `.blink-update-${process.pid}-${Date.now()}`)
  const archive = join(work, 'blink-update.tar.gz')
  const extracted = join(work, 'source')
  await mkdir(extracted, { recursive: true })

  try {
    const response = await fetch(
      `https://codeload.github.com/${BLINK_GITHUB_REPOSITORY}/tar.gz/${update.sha}`,
      { headers: { 'User-Agent': 'BlinkCode-Updater/1.0' } },
    )
    if (!response.ok || !response.body) {
      throw new Error(`Blink update download failed (${response.status}).`)
    }
    await Bun.write(archive, response)
    await run('tar', ['-xzf', archive, '-C', extracted])

    const stagedRoot = await findArchiveRoot(extracted)
    await validateRuntime(stagedRoot)
    await run(bundledBun(), ['install', '--frozen-lockfile'], stagedRoot)
    await writeFile(join(stagedRoot, REVISION_FILE), `${update.sha}\n`, 'utf8')

    const helper = join(work, 'finish-update.ps1')
    const backup = `${root}.previous`
    const script = [
      '$ErrorActionPreference = "Stop"',
      `try { Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue } catch {}`,
      'Start-Sleep -Milliseconds 350',
      `$current = ${quotePowerShell(root)}`,
      `$next = ${quotePowerShell(stagedRoot)}`,
      `$backup = ${quotePowerShell(backup)}`,
      'if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }',
      'Move-Item -LiteralPath $current -Destination $backup',
      'try {',
      '  Move-Item -LiteralPath $next -Destination $current',
      '} catch {',
      '  if (-not (Test-Path -LiteralPath $current)) { Move-Item -LiteralPath $backup -Destination $current }',
      '  throw',
      '}',
      `Remove-Item -LiteralPath ${quotePowerShell(work)} -Recurse -Force -ErrorAction SilentlyContinue`,
    ].join('\r\n')
    await writeFile(helper, script, 'utf8')

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper],
      { detached: true, stdio: 'ignore', windowsHide: true },
    )
    child.unref()
  } catch (error) {
    await rm(work, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

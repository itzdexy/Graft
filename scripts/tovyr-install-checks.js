/**
 * Install / PATH diagnostics for `tovyr setup` and `tovyr doctor`.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function getTovyrPathCandidates(env = process.env) {
  const home = env.USERPROFILE || env.HOME || homedir()
  const npmBin = env.APPDATA ? join(env.APPDATA, 'npm') : ''
  const localBin = home ? join(home, '.local', 'bin') : ''
  return [localBin, npmBin].filter(Boolean)
}

export function pathEntries(pathEnv = process.env.PATH || '') {
  return pathEnv
    .split(process.platform === 'win32' ? ';' : ':')
    .map(p => p.trim())
    .filter(Boolean)
}

export function pathContainsDir(pathEnv, dir) {
  if (!dir) return false
  const target = dir.replace(/\\/g, '/').toLowerCase()
  return pathEntries(pathEnv).some(entry => {
    try {
      return entry.replace(/\\/g, '/').toLowerCase() === target
    } catch {
      return false
    }
  })
}

export function missingPathDirs(pathEnv, candidates = getTovyrPathCandidates()) {
  return candidates.filter(dir => !pathContainsDir(pathEnv, dir))
}

export function formatPathFixHint(missingDirs, platform = process.platform) {
  if (missingDirs.length === 0) return ''
  const joined =
    platform === 'win32' ? missingDirs.join(';') : missingDirs.join(':')
  if (platform === 'win32') {
    return [
      'Close Command Prompt and open a NEW window, or run:',
      `  set PATH=%PATH%;${joined}`,
    ].join('\n')
  }
  return `Add to PATH: ${joined}`
}

export function npmGlobalTovyrShimPaths(env = process.env) {
  if (!env.APPDATA) return []
  const npmBin = join(env.APPDATA, 'npm')
  return [join(npmBin, 'tovyr.cmd'), join(npmBin, 'tovyr')].filter(p =>
    existsSync(p),
  )
}

export function localTovyrShimPaths(env = process.env) {
  const home = env.USERPROFILE || env.HOME || homedir()
  if (!home) return []
  const localBin = join(home, '.local', 'bin')
  return [join(localBin, 'tovyr.cmd'), join(localBin, 'tovyr.ps1')].filter(p =>
    existsSync(p),
  )
}

export function summarizeInstallPathState(env = process.env) {
  const candidates = getTovyrPathCandidates(env)
  const missing = missingPathDirs(env.PATH || '', candidates)
  const npmShims = npmGlobalTovyrShimPaths(env)
  const localShims = localTovyrShimPaths(env)
  const hasShim = npmShims.length > 0 || localShims.length > 0
  const pathOk = missing.length === 0
  return {
    candidates,
    missingPathDirs: missing,
    npmShims,
    localShims,
    hasShim,
    pathOk,
    pathFixHint: formatPathFixHint(missing),
  }
}

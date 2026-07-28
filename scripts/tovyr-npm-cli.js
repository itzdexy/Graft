/**
 * Spawn npm without shell:true on Windows (avoids DEP0190).
 * Falls back to npm.cmd only when npm-cli.js cannot be located.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

/** Resolve global npm-cli.js next to the active Node install. */
export function resolveNpmCliJs() {
  const nodeDir = dirname(process.execPath)
  const candidates = [
    join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ]
  if (process.env.APPDATA) {
    candidates.push(
      join(process.env.APPDATA, 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    )
  }
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

export function spawnNpm(args, options = {}) {
  const cli = resolveNpmCliJs()
  if (cli) {
    return spawnSync(process.execPath, [cli, ...args], {
      shell: false,
      ...options,
    })
  }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  return spawnSync(npm, args, {
    shell: process.platform === 'win32',
    ...options,
  })
}

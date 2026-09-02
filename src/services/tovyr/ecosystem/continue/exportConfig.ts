import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { buildContinueConfigFragment } from '../adapters/continue-dev.js'

export function continueConfigPath(cwd: string): string {
  return join(cwd, '.continue', 'config.yaml')
}

export function writeContinueConfigFragment(cwd: string): { path: string; created: boolean } {
  const dir = join(cwd, '.continue')
  const path = continueConfigPath(cwd)
  if (existsSync(path)) {
    return { path, created: false }
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(path, buildContinueConfigFragment(basename(cwd)) + '\n', 'utf8')
  return { path, created: true }
}

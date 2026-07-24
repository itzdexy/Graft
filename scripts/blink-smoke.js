#!/usr/bin/env node
/**
 * Optional CI/local E2E smoke: blink -p with a real API key.
 * Skips (exit 0) when BLINK_SMOKE_API_KEY is unset.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { getBlinkPackageRoot } from './blink-package-root.js'

const key = process.env.BLINK_SMOKE_API_KEY?.trim()
if (!key) {
  console.log('BLINK_SMOKE_API_KEY not set — skipping optional E2E smoke.')
  process.exit(0)
}

const root = getBlinkPackageRoot()
const launcher = join(root, 'bin', 'blink.js')
if (!existsSync(launcher)) {
  console.error(`Smoke test: missing launcher at ${launcher}`)
  process.exit(1)
}

const env = {
  ...process.env,
  BLINK_FAST: '1',
  BLINK_API_KEY: key,
}

console.log('Running optional E2E smoke: blink -p …')
const result = spawnSync(
  process.execPath,
  [launcher, '-p', 'Reply exactly: OK'],
  { cwd: root, stdio: 'inherit', env, shell: false },
)

if ((result.status ?? 1) !== 0) {
  console.error('E2E smoke failed.')
  process.exit(result.status ?? 1)
}

console.log('E2E smoke passed.')

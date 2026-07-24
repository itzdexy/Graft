/**
 * blink bench — benchmark harness for scoring CLI quality.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertBunAvailable,
  getBlinkPackageRoot,
} from './blink-package-root.js'
import { EXIT, isJsonMode, parseGlobalCliFlags } from './blink-cli-ux.js'

const root = getBlinkPackageRoot()
const runner = join(root, 'scripts', 'blink-bench-runner.ts')

const rawArgv = process.argv.slice(2)
const { argv } = parseGlobalCliFlags(rawArgv)

if (argv.includes('--help') || argv.includes('-h')) {
  const bun = assertBunAvailable()
  spawnSync(bun, [runner, '--help'], { stdio: 'inherit', cwd: root })
  process.exit(EXIT.OK)
}

if (!existsSync(runner)) {
  console.error('Missing benchmark runner (scripts/blink-bench-runner.ts)')
  process.exit(EXIT.ERROR)
}

let bun
try {
  bun = assertBunAvailable()
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(EXIT.ERROR)
}

const result = spawnSync(bun, [runner, ...argv], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BLINK_PACKAGE_ROOT: root,
    BLINK_SRC: root,
    ...(isJsonMode() ? { BLINK_JSON: '1' } : {}),
  },
  stdio: 'inherit',
})

process.exit(result.status ?? EXIT.ERROR)

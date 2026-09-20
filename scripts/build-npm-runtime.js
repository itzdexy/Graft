#!/usr/bin/env node
/**
 * Build the npm runtime as Bun JavaScript.
 *
 * Graft's npm package must contain the product UI and agent runtime, not only
 * a launcher. The result remains Bun/source JavaScript (never graft.exe).
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  getGraftPackageRoot,
  resolveBunExecutable,
} from './graft-package-root.js'

const root = getGraftPackageRoot()
const runtimeDir = join(root, 'runtime')
const entry = join(root, 'src', 'entrypoints', 'cli.tsx')

if (!existsSync(entry)) {
  console.error(`Missing Graft source entry: ${entry}`)
  process.exit(1)
}

const result = spawnSync(
  resolveBunExecutable(),
  ['run', join(root, 'scripts', 'build-graft-runtime.ts')],
  {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      GRAFT_RUNTIME_OUTPUT_DIR: runtimeDir,
      GRAFT_RUNTIME_ENTRY_NAME: 'cli.js',
      GRAFT_RUNTIME_BUNDLE_PACKAGES: '1',
    },
  },
)

if (result.error) {
  console.error(`Graft runtime build failed: ${result.error.message}`)
  process.exit(1)
}
if (result.status !== 0 || !existsSync(join(runtimeDir, 'cli.js'))) {
  console.error(`Graft runtime build failed (exit ${result.status ?? 1})`)
  process.exit(result.status ?? 1)
}

console.log('Graft npm runtime ready: runtime/cli.js')

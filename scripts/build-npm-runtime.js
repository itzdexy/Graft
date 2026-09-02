#!/usr/bin/env node
/**
 * Build the npm runtime as Bun JavaScript.
 *
 * Tovyr's npm package must contain the product UI and agent runtime, not only
 * a launcher. The result remains Bun/source JavaScript (never tovyr.exe).
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  getTovyrPackageRoot,
  resolveBunExecutable,
} from './tovyr-package-root.js'

const root = getTovyrPackageRoot()
const runtimeDir = join(root, 'runtime')
const entry = join(root, 'src', 'entrypoints', 'cli.tsx')

if (!existsSync(entry)) {
  console.error(`Missing Tovyr source entry: ${entry}`)
  process.exit(1)
}

const result = spawnSync(
  resolveBunExecutable(),
  ['run', join(root, 'scripts', 'build-tovyr-runtime.ts')],
  {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      TOVYR_RUNTIME_OUTPUT_DIR: runtimeDir,
      TOVYR_RUNTIME_ENTRY_NAME: 'cli.js',
      TOVYR_RUNTIME_BUNDLE_PACKAGES: '1',
    },
  },
)

if (result.error) {
  console.error(`Tovyr runtime build failed: ${result.error.message}`)
  process.exit(1)
}
if (result.status !== 0 || !existsSync(join(runtimeDir, 'cli.js'))) {
  console.error(`Tovyr runtime build failed (exit ${result.status ?? 1})`)
  process.exit(result.status ?? 1)
}

console.log('Tovyr npm runtime ready: runtime/cli.js')

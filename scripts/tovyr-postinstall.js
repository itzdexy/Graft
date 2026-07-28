/**
 * Postinstall — warm UI compile when running from full source checkout.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(import.meta.url), '..', '..')
const cli = join(root, 'entrypoints', 'cli.tsx')
const warm = join(root, 'scripts', 'tovyr-warm.js')

if (!existsSync(cli) || !existsSync(warm)) {
  process.exit(0)
}

const child = spawn(process.execPath, [warm], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => process.exit(code ?? 0))

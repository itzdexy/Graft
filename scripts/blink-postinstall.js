/**
 * Postinstall — warm UI compile when running from full source checkout.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(import.meta.url), '..', '..')
const cli = join(root, 'entrypoints', 'cli.tsx')
const warm = join(root, 'scripts', 'blink-warm.js')

function bunOnPath() {
  const override = process.env.BLINK_BUN_CMD?.trim()
  if (override && existsSync(override)) return override
  const names =
    process.platform === 'win32' ? ['bun.exe', 'bun.cmd', 'bun'] : ['bun']
  const pathEnv = process.env.PATH ?? ''
  for (const dir of pathEnv.split(process.platform === 'win32' ? ';' : ':')) {
    if (!dir) continue
    for (const name of names) {
      const full = join(dir, name)
      if (existsSync(full)) return full
    }
  }
  return null
}

if (!existsSync(cli) || !existsSync(warm)) {
  console.log('blinkcode: launcher install — applying branding patch.')
  try {
    const { patchClaudeBinaryBranding } = await import('./blink-patch-binary.js')
    const result = patchClaudeBinaryBranding()
    if (result.patched) {
      console.log('blinkcode: patched binary for Blink branding.')
    }
  } catch (err) {
    console.warn(
      'blinkcode: could not patch binary:',
      err instanceof Error ? err.message : String(err),
    )
  }
  if (process.platform === 'win32') {
    console.log(
      'blinkcode: if `blink` is not recognized in CMD, open a NEW Command Prompt or run: blink setup',
    )
  }
  process.exit(0)
}

const bun = bunOnPath()
if (!bun) {
  console.log(
    'blinkcode: source checkout detected — install Bun (https://bun.sh), then run: npm run warm',
  )
  process.exit(0)
}

const child = spawn(process.execPath, [warm], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, BLINK_BUN_CMD: bun },
})

child.on('error', (err) => {
  console.warn(
    'blinkcode: warm compile skipped:',
    err instanceof Error ? err.message : String(err),
  )
  process.exit(0)
})

child.on('exit', (code) => process.exit(code ?? 0))

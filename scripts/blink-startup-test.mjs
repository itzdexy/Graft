import { spawn } from 'node:child_process'
import { resolveBunExecutable, resolveBlinkCliEntry, getBlinkPackageRoot } from './blink-package-root.js'

const root = getBlinkPackageRoot()
const bun = resolveBunExecutable()
const entry = resolveBlinkCliEntry(root)
const args = ['entrypoints/cli.tsx', '--bare', '--debug-to-stderr']

const child = spawn(bun, args, {
  cwd: root,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    BLINK_FORCE_INTERACTIVE: '1',
    BLINK_PACKAGE_ROOT: root,
  },
})

let stdoutBytes = 0
child.stdout.on('data', (d) => {
  stdoutBytes += d.length
  if (stdoutBytes < 500) process.stdout.write(d)
})
child.stderr.on('data', (d) => {
  const s = d.toString()
  if (
    /\[STARTUP\]|launchRepl|action_|profile|ERROR|Error:|Welcome|Blink|validateForce|mcpConfig|hooks|InvalidSettings|Lock acquisition|rendering/i.test(
      s,
    )
  ) {
    process.stderr.write(s)
  }
})

const deadline = Date.now() + 90_000
const tick = setInterval(() => {
  if (Date.now() > deadline) {
    clearInterval(tick)
    console.error(`\n--- after 90s: stdoutBytes=${stdoutBytes}, killing ---`)
    child.kill()
  }
}, 1000)

child.on('exit', (code) => {
  clearInterval(tick)
  console.error(`exit ${code}, stdoutBytes=${stdoutBytes}`)
})

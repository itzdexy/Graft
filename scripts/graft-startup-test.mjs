import { spawn } from 'node:child_process'
import { resolveBunExecutable, resolveGraftCliEntry, getGraftPackageRoot } from './graft-package-root.js'

const root = getGraftPackageRoot()
const bun = resolveBunExecutable()
const entry = resolveGraftCliEntry(root)
const args = [entry, '--bare', '--debug-to-stderr']

const child = spawn(bun, args, {
  cwd: root,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    GRAFT_FORCE_INTERACTIVE: '1',
    GRAFT_PACKAGE_ROOT: root,
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
    /\[STARTUP\]|launchRepl|action_|profile|ERROR|Error:|Welcome|Graft|validateForce|mcpConfig|hooks|InvalidSettings|Lock acquisition|rendering/i.test(
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

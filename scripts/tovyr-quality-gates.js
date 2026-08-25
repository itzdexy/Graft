import { spawnSync } from 'node:child_process'

const commands = [
  ['bun', ['test']],
  ['bun', ['run', 'typecheck:tovyr']],
  ['bun', ['run', 'check:dead-ui']],
  ['bun', ['run', 'check:brand']],
]

for (const [file, args] of commands) {
  const result = spawnSync(file, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

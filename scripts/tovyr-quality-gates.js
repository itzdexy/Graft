import { spawnSync } from 'node:child_process'

// Tovyr's typecheck covers the import-clean runtime and domain core listed in
// tsconfig.tovyr.json; broader application typing remains an upstream concern.
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

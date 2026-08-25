import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Tovyr's typecheck covers the import-clean runtime and domain core listed in
// tsconfig.tovyr.json; broader application typing remains an upstream concern.
export const qualityGateCommands = [
  ['bun', ['test']],
  ['bun', ['run', 'typecheck:tovyr']],
  ['bun', ['run', 'check:dead-ui']],
  ['bun', ['run', 'check:brand']],
]

export function runTovyrQualityGates(spawn = spawnSync) {
  for (const [file, args] of qualityGateCommands) {
    const result = spawn(file, args, { stdio: 'inherit' })
    if (result.status !== 0) return result.status ?? 1
  }
  return 0
}

const invokedAsScript =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (invokedAsScript) {
  process.exitCode = runTovyrQualityGates()
}

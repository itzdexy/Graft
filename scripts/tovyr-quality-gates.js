import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// The gates check what the CLI actually loads.
//
// They used to check far less: `test` ran a hardcoded list of ~10 directories
// (623 tests) while the repo held 1,568, and `typecheck:tovyr` covered seven
// hand-picked files. Both were green while the CLI surface carried ~1,400
// unchecked type errors. `npm test` is now plain `bun test` and `npm run
// typecheck` is rooted at the real entrypoints (tsconfig.app.json), so a
// module is covered because the CLI imports it -- not because someone
// remembered to add it to a list.
export const qualityGateCommands = [
  ['bun', ['run', 'test']],
  ['bun', ['run', 'typecheck']],
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

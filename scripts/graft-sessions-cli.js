/**
 * CLI: graft sessions list — resumable sessions for the current project.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  getGraftPackageRoot,
  resolveBunExecutable,
  resolveGraftCliEntry,
} from './graft-package-root.js'
import {
  EXIT,
  isJsonMode,
  parseGlobalCliFlags,
  printSessionsHelp,
} from './graft-cli-ux.js'

const root = getGraftPackageRoot()
const { argv } = parseGlobalCliFlags(process.argv.slice(2))

if (argv.includes('--help') || argv.includes('-h')) {
  printSessionsHelp()
  process.exit(EXIT.OK)
}

const sub = argv[0]
if (!sub) {
  printSessionsHelp()
  process.exit(EXIT.OK)
}
if (sub !== 'list') {
  console.error(`Unknown subcommand: "${sub}"`)
  console.error('Usage: graft sessions list [--limit=N]')
  console.error('Run: graft sessions --help')
  process.exit(EXIT.USAGE)
}

const cliEntry = resolveGraftCliEntry(root)
if (!cliEntry) {
  console.error(
    'Session listing requires the source checkout (src/entrypoints/cli.tsx).\n' +
      'Clone the repo or run `graft` and use /resume in the app.',
  )
  process.exit(EXIT.ERROR)
}

const bun = resolveBunExecutable()
const runner = join(root, 'scripts', 'graft-sessions-runner.ts')
const env = {
  ...process.env,
  GRAFT_INVOKE_CWD: process.env.GRAFT_INVOKE_CWD || process.cwd(),
}
if (isJsonMode()) env.GRAFT_JSON = '1'

const result = spawnSync(bun, [runner, ...argv.slice(1)], {
  cwd: root,
  encoding: 'utf8',
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
process.exit(result.status ?? EXIT.ERROR)

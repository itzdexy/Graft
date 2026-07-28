/**
 * CLI: tovyr sessions list — resumable sessions for the current project.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  getTovyrPackageRoot,
  resolveBunExecutable,
  resolveTovyrCliEntry,
} from './tovyr-package-root.js'
import {
  EXIT,
  isJsonMode,
  parseGlobalCliFlags,
  printSessionsHelp,
} from './tovyr-cli-ux.js'

const root = getTovyrPackageRoot()
const { argv } = parseGlobalCliFlags(process.argv.slice(2))

if (argv.includes('--help') || argv.includes('-h')) {
  printSessionsHelp()
  process.exit(EXIT.OK)
}

const sub = argv[0]
if (sub !== 'list') {
  console.error('Usage: tovyr sessions list [--limit=N]')
  console.error('Run: tovyr sessions --help')
  process.exit(EXIT.USAGE)
}

const cliEntry = resolveTovyrCliEntry(root)
if (!cliEntry) {
  console.error(
    'Session listing requires the source checkout (entrypoints/cli.tsx).\n' +
      'Clone the repo or run `tovyr` and use /resume in the app.',
  )
  process.exit(EXIT.ERROR)
}

const bun = resolveBunExecutable()
const runner = join(root, 'scripts', 'tovyr-sessions-runner.ts')
const env = {
  ...process.env,
  TOVYR_INVOKE_CWD: process.env.TOVYR_INVOKE_CWD || process.cwd(),
}
if (isJsonMode()) env.TOVYR_JSON = '1'

const result = spawnSync(bun, [runner, ...argv.slice(1)], {
  cwd: root,
  encoding: 'utf8',
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
process.exit(result.status ?? EXIT.ERROR)

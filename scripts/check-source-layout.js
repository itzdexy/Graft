import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const legacySourceDirectories = [
  'agents',
  'assistant',
  'bootstrap',
  'bridge',
  'browser',
  'buddy',
  'build',
  'cli',
  'codemode',
  'commands',
  'components',
  'constants',
  'context',
  'coordinator',
  'git',
  'hooks',
  'i18n',
  'inference',
  'ink',
  'intelligence',
  'keybindings',
  'lsp',
  'mcp',
  'memdir',
  'memory',
  'migrations',
  'moreright',
  'native-ts',
  'outputStyles',
  'plugins',
  'providers',
  'query',
  'remote',
  'schemas',
  'screens',
  'server',
  'services',
  'skills',
  'slash',
  'state',
  'tasks',
  'test-support',
  'tools',
  'types',
  'upstreamproxy',
  'utils',
  'vim',
  'voice',
]

const forbiddenDirectories = ['chrome-extension', ...legacySourceDirectories]
const exactArtifacts = new Set([
  '_graft-test-out.txt',
  '.package.dev.json.bak',
  '.README.dev.md.bak',
  '.graft-gateway.err.log',
  '.graft-gateway.out.log',
  '.graft-test-err.txt',
  '.graft-test-out.txt',
  'errs.txt',
  'filelist.txt',
  'lsfiles.txt',
  'nul',
  'status.txt',
  'graft-test-errors.txt',
  'graft-test-results.txt',
  'graftcode-1.2.0.tgz',
])

export function findLayoutViolations(root) {
  const resolvedRoot = resolve(root)
  const violations = []

  for (const directory of forbiddenDirectories) {
    const candidate = join(resolvedRoot, directory)
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      violations.push(`${directory}/`)
    }
  }

  for (const entry of readdirSync(resolvedRoot, { withFileTypes: true })) {
    if (entry.isFile() && exactArtifacts.has(entry.name)) {
      violations.push(entry.name)
    }
  }

  return violations.sort((left, right) => left.localeCompare(right))
}

function run() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const violations = findLayoutViolations(root)
  if (violations.length === 0) {
    console.log('Graft source layout is clean.')
    return
  }

  console.error('Graft source layout violations:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exitCode = 1
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) run()

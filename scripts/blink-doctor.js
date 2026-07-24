/**
 * Verify Blink install: Bun, source checkout, API key, warm compile.
 */
import { accessSync, constants, existsSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { BLINK_VERSION, BLINK_PRODUCT_NAME } from '../constants/blink.js'
import {
  getBlinkPackageRoot,
  platformLabel,
  resolveBunExecutable,
  resolveBlinkCliEntry,
} from './blink-package-root.js'
import { getProvider, loadState, resolveActive } from './blink-providers.js'
import { getBlinkHome } from './blink-home.js'
import { summarizeInstallPathState } from './blink-install-checks.js'
import { blinkWarmNeeded } from './blink-warm.js'
import { formatAgentLimitsSummary } from './blink-agent-limits.js'
import {
  cliExit,
  isJsonMode,
  isQuiet,
  parseGlobalCliFlags,
  printDoctorHelp,
  printFirstRunOnboarding,
  EXIT,
} from './blink-cli-ux.js'

const root = getBlinkPackageRoot()
const rawArgv = process.argv.slice(2)
const { argv } = parseGlobalCliFlags(rawArgv)

if (argv.includes('--help') || argv.includes('-h')) {
  printDoctorHelp()
  process.exit(EXIT.OK)
}

let failed = 0
let warned = 0
/** @type {Array<{ name: string, status: 'pass' | 'warn' | 'fail', detail?: string }>} */
const checks = []

function record(name, status, detail = '') {
  checks.push({ name, status, detail: detail || undefined })
  if (status === 'fail') failed++
  if (status === 'warn') warned++
}

function ok(label, detail = '') {
  if (!isJsonMode() && !isQuiet()) {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  }
  record(label, 'pass', detail)
}

function fail(label, detail = '') {
  if (!isJsonMode() && !isQuiet()) {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
  record(label, 'fail', detail)
}

function warn(label, detail = '') {
  if (!isJsonMode() && !isQuiet()) {
    console.log(`  ! ${label}${detail ? ` — ${detail}` : ''}`)
  }
  record(label, 'warn', detail)
}

function checkBlinkOnPath() {
  const pathState = summarizeInstallPathState()
  const lookup = process.platform === 'win32' ? 'where blink' : 'which blink'
  const out = spawnSync(lookup, { shell: true, encoding: 'utf8' })
  const found = out.status === 0 && out.stdout.trim().length > 0

  if (found) {
    const first = out.stdout.trim().split(/\r?\n/)[0]
    ok('`blink` on PATH', first)
    return
  }

  if (pathState.hasShim) {
    fail(
      '`blink` on PATH',
      'shim exists but this terminal PATH is stale — open a NEW terminal',
    )
    if (!isJsonMode() && !isQuiet() && pathState.pathFixHint) {
      console.error('')
      console.error(pathState.pathFixHint)
      console.error('')
    }
    const shim =
      pathState.npmShims[0] ||
      pathState.localShims[0] ||
      '(run bin\\install-blink.cmd from the repo)'
    if (!isJsonMode() && !isQuiet()) {
      console.error(`  Works without PATH fix: "${shim}"`)
    }
    return
  }

  fail(
    '`blink` on PATH',
    'not installed globally — run: npm install -g blinkcode',
  )
}

function checkPathDirectories() {
  const pathState = summarizeInstallPathState()
  if (pathState.pathOk) {
    ok('PATH includes blink dirs', pathState.candidates.join(', '))
    return
  }
  warn(
    'PATH missing blink directories',
    pathState.missingPathDirs.join('; '),
  )
  if (!isJsonMode() && !isQuiet() && pathState.pathFixHint) {
    console.log('')
    console.log(pathState.pathFixHint)
    console.log('')
  }
}

const invokedAs = process.env.BLINK_DOCTOR_INVOKED_AS === 'setup' ? 'setup' : 'doctor'
if (!isJsonMode() && !isQuiet()) {
  const title =
    invokedAs === 'setup'
      ? `${BLINK_PRODUCT_NAME} setup — first-run checks`
      : `${BLINK_PRODUCT_NAME} doctor`
  console.log(`${title} v${BLINK_VERSION} (${platformLabel()})\n`)
}

checkBlinkOnPath()
checkPathDirectories()

const cliEntry = resolveBlinkCliEntry(root)
const launcherOnly = !cliEntry

if (cliEntry) {
  ok('Source checkout', cliEntry)
} else {
  warn(
    'Source checkout',
    'npm launcher mode — clone github.com/itsdexy/BlinkCode for full UI',
  )
}

const bun = resolveBunExecutable()
if (launcherOnly) {
  if (bun !== 'bun' && existsSync(bun)) {
    ok('Bun (optional)', `${bun} — only needed for source install`)
  } else {
    try {
      const lookup = process.platform === 'win32' ? 'where bun' : 'which bun'
      const out = spawnSync(lookup, { shell: true, encoding: 'utf8' })
      if (out.status === 0 && out.stdout.trim()) {
        ok('Bun (optional)', 'installed — use source checkout for full UI')
      } else {
        ok('Bun', 'not required for npm launcher')
      }
    } catch {
      ok('Bun', 'not required for npm launcher')
    }
  }
} else if (bun !== 'bun' && existsSync(bun)) {
  ok('Bun', bun)
} else {
  try {
    const lookup = process.platform === 'win32' ? 'where bun' : 'which bun'
    const out = spawnSync(lookup, { shell: true, encoding: 'utf8' })
    if (out.status === 0 && out.stdout.trim()) {
      ok('Bun', out.stdout.trim().split(/\r?\n/)[0])
    } else {
      fail('Bun', 'not found — https://bun.sh')
    }
  } catch {
    fail('Bun', 'not found — https://bun.sh')
  }
}

const active = resolveActive()
const apiKeyMissing = !(active?.apiKey && active.apiKey.length >= 8)
const state = loadState()
const activated = Object.keys(state.keys || {}).filter(id => {
  const key = state.keys[id]
  return key && key.length >= 8 && getProvider(id, state)
})
if (!apiKeyMissing) {
  ok('API key', `${active.label} · ${active.model || 'default model'}`)
} else {
  warn('Provider', 'none selected — Blink will ask on first launch')
}

const home = getBlinkHome()
if (home && existsSync(join(home, '.blink', 'providers.json'))) {
  ok('Providers config', join(home, '.blink', 'providers.json'))
} else {
  warn('Providers config', 'not created yet — choose a provider in Blink')
}

if (existsSync(join(root, 'node_modules'))) {
  ok('Dependencies', 'node_modules present')
} else if (launcherOnly) {
  ok('Dependencies', 'npm launcher — node_modules not required')
} else {
  fail('Dependencies', 'run: npm install')
}

try {
  const lookup = process.platform === 'win32' ? 'where git' : 'which git'
  const out = spawnSync(lookup, { shell: true, encoding: 'utf8' })
  if (out.status === 0 && out.stdout.trim()) {
    ok('Git', out.stdout.trim().split(/\r?\n/)[0])
  } else {
    warn('Git', 'not on PATH — diff-aware review/plan disabled')
  }
} catch {
  warn('Git', 'not on PATH')
}

if (home) {
  try {
    accessSync(home, constants.W_OK)
    ok('Home writable', home)
  } catch {
    fail('Home writable', `${home} — check permissions`)
  }
}

if (!launcherOnly) {
  if (blinkWarmNeeded()) {
    warn('Warm compile cache', 'stale — first launch may compile 1–3 min')
  } else {
    ok('Warm compile cache', 'ready')
  }
}

if (activated.length > 1) {
  ok('Provider failover', `${activated.length} keys saved — auto-failover available`)
} else if (!apiKeyMissing) {
  warn('Provider failover', 'only one provider key — add another for redundancy')
}

if (!isJsonMode() && !isQuiet() && !launcherOnly) {
  console.log('')
  console.log(`  ${formatAgentLimitsSummary()}`)
}

if (isJsonMode()) {
  cliExit(failed === 0 ? EXIT.OK : EXIT.ERROR, {
    data: {
      version: BLINK_VERSION,
      invokedAs,
      checks,
      warnings: warned,
      failures: failed,
    },
  })
}

if (!isJsonMode() && !isQuiet()) {
  console.log('')
}

if (failed === 0) {
  if (!isJsonMode() && !isQuiet()) {
    if (apiKeyMissing && invokedAs === 'setup') {
      printFirstRunOnboarding()
    }
    if (warned > 0) {
      console.log(
        'Ready with warnings. Open a NEW terminal if `blink` was missing from PATH.',
      )
    } else {
      console.log('All checks passed. Run: blink')
    }
  }
  process.exit(EXIT.OK)
}

if (!isJsonMode() && !isQuiet()) {
  if (apiKeyMissing && invokedAs === 'setup') {
    printFirstRunOnboarding()
  }
  console.error(
    `${failed} check(s) failed. Fix the items above, then run: blink doctor`,
  )
}
process.exit(EXIT.ERROR)

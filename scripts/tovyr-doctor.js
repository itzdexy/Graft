/**
 * Verify Tovyr install: Bun, source checkout, API key, warm compile.
 */
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { TOVYR_VERSION, TOVYR_PRODUCT_NAME } from '../src/constants/tovyr.js'
import {
  getTovyrPackageRoot,
  platformLabel,
  resolveBunExecutable,
  resolveTovyrCliEntry,
} from './tovyr-package-root.js'
import { getProvider, loadState, resolveActive } from './tovyr-providers.js'
import { getTovyrHome } from './tovyr-home.js'
import { summarizeInstallPathState } from './tovyr-install-checks.js'
import { tovyrWarmNeeded } from './tovyr-warm.js'
import { formatAgentLimitsSummary } from './tovyr-agent-limits.js'
import { listAppAdapters } from './tovyr-apps/catalog.js'
import {
  detectTovyrPlatform,
  formatTovyrPlatform,
} from './tovyr-platform.js'
import {
  cliExit,
  isExportMode,
  isJsonMode,
  isQuiet,
  parseGlobalCliFlags,
  printDoctorHelp,
  printFirstRunOnboarding,
  EXIT,
} from './tovyr-cli-ux.js'

const root = getTovyrPackageRoot()
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

function checkTovyrOnPath() {
  const pathState = summarizeInstallPathState()
  const lookup = process.platform === 'win32' ? 'where tovyr' : 'which tovyr'
  const out = spawnSync(lookup, { shell: true, encoding: 'utf8' })
  const found = out.status === 0 && out.stdout.trim().length > 0

  if (found) {
    const first = out.stdout.trim().split(/\r?\n/)[0]
    ok('`tovyr` on PATH', first)
    return
  }

  if (pathState.hasShim) {
    fail(
      '`tovyr` on PATH',
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
      '(run bin\\install-tovyr.cmd from the repo)'
    if (!isJsonMode() && !isQuiet()) {
      console.error(`  Works without PATH fix: "${shim}"`)
    }
    return
  }

  fail(
    '`tovyr` on PATH',
    'not installed globally — run: npm install -g tovyrcode',
  )
}

function checkPathDirectories() {
  const pathState = summarizeInstallPathState()
  if (pathState.pathOk) {
    ok('PATH includes tovyr dirs', pathState.candidates.join(', '))
    return
  }
  warn(
    'PATH missing tovyr directories',
    pathState.missingPathDirs.join('; '),
  )
  if (!isJsonMode() && !isQuiet() && pathState.pathFixHint) {
    console.log('')
    console.log(pathState.pathFixHint)
    console.log('')
  }
}

function checkBrowserDeps() {
  const hasNpx = (() => {
    try {
      const cmd = process.platform === 'win32' ? 'where npx' : 'which npx'
      const out = spawnSync(cmd, { shell: true, encoding: 'utf8' })
      return out.status === 0 && out.stdout.trim().length > 0
    } catch {
      return false
    }
  })()
  const playwrightDir = join(root, 'node_modules', 'playwright')
  const playwrightMcpDir = join(root, 'node_modules', '@playwright', 'mcp')

  if (existsSync(playwrightDir) && existsSync(playwrightMcpDir)) {
    ok(
      'Browser dependencies',
      `Playwright + MCP present at ${root}/node_modules`,
    )
    return
  }
  if (hasNpx) {
    warn(
      'Browser dependencies',
      'Playwright not installed locally; use /browser in Tovyr to configure Playwright MCP',
    )
    return
  }
  warn(
    'Browser dependencies',
    'npx not found — browser tools will not work until Playwright MCP is installed',
  )
}

function checkMcpConfig() {
  const userMcp = home ? join(home, '.tovyr', 'mcp.json') : ''
  const projectMcp = join(process.cwd(), '.mcp.json')
  const globalMcp = home ? join(home, '.tovyr', 'settings.json') : ''
  const sources = []

  if (home && existsSync(userMcp)) sources.push(userMcp)
  if (existsSync(projectMcp)) sources.push(projectMcp)
  if (home && existsSync(globalMcp)) {
    try {
      const text = readFileSync(globalMcp, 'utf8')
      const parsed = JSON.parse(text)
      const mcpServers = parsed?.mcpServers
      if (
        mcpServers &&
        typeof mcpServers === 'object' &&
        Object.keys(mcpServers).length > 0
      ) {
        sources.push(`${globalMcp} (${Object.keys(mcpServers).length} servers)`)
      }
    } catch {
      // ignore malformed settings
    }
  }

  if (sources.length > 0) {
    ok(
      'MCP configuration',
      `${sources.length} source(s): ${sources.join('; ')}`,
    )
    return
  }

  warn(
    'MCP configuration',
    'no MCP servers found — use /mcp to add one, or run: tovyr mcp add',
  )
}

function checkConfigPermissions() {
  const tovyrDir = home ? join(home, '.tovyr') : ''
  if (!tovyrDir) {
    warn('Config directory', 'home directory not found')
    return
  }

  if (!existsSync(tovyrDir)) {
    try {
      mkdirSync(tovyrDir, { recursive: true })
      ok('Config directory', `created ${tovyrDir}`)
    } catch {
      fail('Config directory', `cannot create ${tovyrDir}`)
    }
    return
  }

  try {
    accessSync(tovyrDir, constants.W_OK)
    ok('Config directory writable', tovyrDir)
  } catch {
    fail('Config directory', `${tovyrDir} is not writable`)
  }
}

function checkDiskSpace() {
  const dir = home || process.cwd()
  try {
    if (process.platform === 'win32') {
      const drive = dir[0]?.toUpperCase() || 'C'
      // Try fsutil first (works on all modern Windows; wmic is deprecated in Win11).
      const fsutil = spawnSync(
        'fsutil',
        ['volume', 'diskfree', `${drive}:`],
        { encoding: 'utf8' },
      )
      if (fsutil.status === 0) {
        const match = fsutil.stdout.match(/Total free bytes\s*:\s*(\d+)/i)
        if (match) {
          const freeGB = Number(match[1]) / (1024 ** 3)
          reportFreeSpace(freeGB, dir)
          return
        }
      }
      // Fallback: PowerShell Get-PSDrive (works without admin rights).
      const ps = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-Command', `(Get-PSDrive ${drive}).Free`],
        { encoding: 'utf8' },
      )
      if (ps.status === 0 && ps.stdout.trim()) {
        const freeGB = Number(ps.stdout.trim()) / (1024 ** 3)
        if (!Number.isNaN(freeGB)) {
          reportFreeSpace(freeGB, dir)
          return
        }
      }
      throw new Error('could not read free space')
    }

    const out = spawnSync('df -k .', { shell: true, encoding: 'utf8' })
    const lines = out.stdout.trim().split(/\r?\n/)
    const data = lines.at(-1)?.trim().split(/\s+/)
    if (!data || data.length < 4) throw new Error('df output unexpected')
    const freeKB = Number(data[3])
    if (Number.isNaN(freeKB)) throw new Error('df free space not numeric')
    const freeGB = freeKB / (1024 ** 2)
    reportFreeSpace(freeGB, dir)
  } catch {
    warn('Disk space', `could not determine free space at ${dir}`)
  }
}

function reportFreeSpace(freeGB, dir) {
  if (freeGB >= 1) {
    ok('Disk space', `${freeGB.toFixed(1)} GB free at ${dir}`)
  } else {
    warn('Disk space', `${freeGB.toFixed(1)} GB free at ${dir}`)
  }
}

// This is intentionally catalog-only. A normal `tovyr doctor` run must not
// start the gateway or make provider/API requests just to report integrations.
function checkApplicationAdapters() {
  const adapters = listAppAdapters()
  const ids = new Set(adapters.map(adapter => adapter.id))
  if (ids.size === adapters.length && adapters.length > 0) {
    ok('Application adapters', `${adapters.length} clients available — run: tovyr apps status`)
  } else {
    fail('Application adapters', 'catalog contains duplicate or missing client ids')
  }
}

const home = getTovyrHome()
const invokedAs = process.env.TOVYR_DOCTOR_INVOKED_AS === 'setup' ? 'setup' : 'doctor'
if (!isJsonMode() && !isQuiet()) {
  const title =
    invokedAs === 'setup'
      ? `${TOVYR_PRODUCT_NAME} setup — first-run checks`
      : `${TOVYR_PRODUCT_NAME} doctor`
  console.log(`${title} v${TOVYR_VERSION} (${platformLabel()})\n`)
}

checkTovyrOnPath()
checkPathDirectories()
checkConfigPermissions()
checkDiskSpace()
checkApplicationAdapters()

const runtimePlatform = detectTovyrPlatform()
if (runtimePlatform.supported) {
  ok(
    'Runtime platform',
    `${formatTovyrPlatform(runtimePlatform)} · ${runtimePlatform.libc}`,
  )
  if (runtimePlatform.termux) {
    warn(
      'Termux compatibility',
      'requires pkg install glibc patchelf; Android/Bionic is not a Bun target',
    )
  }
} else {
  fail('Runtime platform', runtimePlatform.reason)
}

const cliEntry = resolveTovyrCliEntry(root)
const launcherOnly = !cliEntry

if (cliEntry) {
  ok('Source checkout', cliEntry)
} else {
  warn(
    'Source checkout',
    'npm launcher mode — clone github.com/itzdexy/Tovyr for full UI',
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
  warn('Provider', 'none selected — Tovyr will ask on first launch')
}

if (home && existsSync(join(home, '.tovyr', 'providers.json'))) {
  ok('Providers config', join(home, '.tovyr', 'providers.json'))
} else {
  warn('Providers config', 'not created yet — choose a provider in Tovyr')
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

checkBrowserDeps()
checkMcpConfig()

if (home) {
  try {
    accessSync(home, constants.W_OK)
    ok('Home writable', home)
  } catch {
    fail('Home writable', `${home} — check permissions`)
  }
}

{
  const telemetryOn = process.env.TOVYR_CODE_ENABLE_TELEMETRY === '1'
  const essentialOnly = Boolean(process.env.TOVYR_CODE_DISABLE_NONESSENTIAL_TRAFFIC)
  const level = telemetryOn
    ? 'default (telemetry opted in)'
    : essentialOnly
      ? 'essential-traffic'
      : 'no-telemetry (default)'
  ok('Privacy', level)
}

if (!launcherOnly) {
  if (tovyrWarmNeeded()) {
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

if (isExportMode()) {
  const reportPath = join(
    home || process.cwd(),
    `.tovyr-doctor-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  try {
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          version: TOVYR_VERSION,
          invokedAs,
          timestamp: new Date().toISOString(),
          checks,
          warnings: warned,
          failures: failed,
          passed: failed === 0,
        },
        null,
        2,
      ),
    )
    if (!isQuiet()) {
      console.log(`\nExported doctor report: ${reportPath}`)
    }
  } catch (error) {
    if (!isJsonMode() && !isQuiet()) {
      console.error(`Failed to export report: ${error?.message || error}`)
    }
  }
}

if (isJsonMode()) {
  cliExit(failed === 0 ? EXIT.OK : EXIT.ERROR, {
    data: {
      version: TOVYR_VERSION,
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
        'Ready with warnings. Open a NEW terminal if `tovyr` was missing from PATH.',
      )
    } else {
      console.log('All checks passed. Run: tovyr')
    }
  }
  process.exit(EXIT.OK)
}

if (!isJsonMode() && !isQuiet()) {
  if (apiKeyMissing && invokedAs === 'setup') {
    printFirstRunOnboarding()
  }
  console.error(
    `${failed} check(s) failed. Fix the items above, then run: tovyr doctor`,
  )
}
process.exit(EXIT.ERROR)

#!/usr/bin/env node
/**
 * blinkcode — cross-platform npm entry (Windows, macOS, Linux).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { BLINK_PRODUCT_NAME, BLINK_VERSION } from '../constants/blink.js'
import {
  getBlinkPackageRoot,
  resolveBunExecutable,
  resolveBlinkCliEntry,
  assertBunAvailable,
} from '../scripts/blink-package-root.js'
import { runBlinkWarm, blinkWarmNeeded } from '../scripts/blink-warm.js'
import {
  startBlinkStartupLoader,
  stopBlinkStartupLoader,
} from '../scripts/blink-startup-loader.js'
import { buildBlinkChildAuthEnv } from '../scripts/blink-prep-auth.js'
import {
  applyLauncherDefaultArgs,
  isLauncherOnlyInstall,
  stripAllowHomeFlag,
} from '../scripts/blink-launch-hints.js'
import {
  isQuiet,
  parseGlobalCliFlags,
  printAuthLoginHelp,
  printMainHelp,
  EXIT,
} from '../scripts/blink-cli-ux.js'
import { buildWorkflowPrintArgs } from '../scripts/blink-workflow-prompts.js'
import { resolveActive } from '../scripts/blink-providers.js'
import {
  shouldOpenNewWindow,
  spawnBlinkInNewWindow,
  stripInWindowFlag,
  prepareWindowsTuiConsole,
} from '../scripts/blink-windows-launcher.js'

const PKG_ROOT = getBlinkPackageRoot()

const TITLE = BLINK_PRODUCT_NAME
const TITLE_REFRESH_MS = 250

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) resolve({ signal })
      else resolve({ code: code ?? 0 })
    })
  })
}

function printHelp() {
  printMainHelp()
}

/** Default: fast startup (--bare). Pass --full for marketplace plugins + MCP. */
function buildCliArgs(argv) {
  let args = [...argv]
  if (args.includes('--fast')) {
    args = args.filter(a => a !== '--fast')
    if (!args.includes('--bare')) args = ['--bare', ...args]
    return args
  }
  if (args.includes('--bare')) {
    return args
  }
  if (args.includes('--full')) {
    return args.filter(a => a !== '--full')
  }
  // Skip scanning 100+ Blink plugins on every launch (can hang 10+ min on Windows).
  if (!args.includes('--bare')) {
    args = ['--bare', ...args]
  }
  return args
}

function isBlinkFastLaunch(argv) {
  return !argv.includes('--full')
}

function isInteractiveLaunch(argv) {
  if (argv.includes('-p') || argv.includes('--print')) return false
  if (argv.includes('--help') || argv.includes('-h')) return false
  if (argv.includes('--version') || argv.includes('-v') || argv.includes('-V')) return false
  if (argv.length >= 1 && ['setup', 'doctor', 'bench', 'auth', 'provider', 'config', 'models', 'ask', 'review', 'fix', 'plan', 'sessions'].includes(argv[0])) {
    return false
  }
  return true
}

function blinkChildEnv(argv) {
  const useFast = isBlinkFastLaunch(argv)
  const env = {
    ...process.env,
    BLINK_PACKAGE_ROOT: PKG_ROOT,
    BLINK_SRC: PKG_ROOT,
    BLINK_FORCE_INTERACTIVE: '1',
    // Alt-screen renderer: resize-safe UI (main-screen redraw ghosts on Windows).
    CLAUDE_CODE_NO_FLICKER: process.env.CLAUDE_CODE_NO_FLICKER ?? '1',
    // DA1/XTVERSION probes leak as visible escape garbage on Windows fullscreen.
    ...(process.platform === 'win32'
      ? { BLINK_SKIP_TERMINAL_QUERIES: '1' }
      : {}),
  }
  if (useFast) {
    env.CLAUDE_CODE_SIMPLE = '1'
  }
  return env
}

async function runNodeScript(scriptName, scriptArgs = []) {
  const script = path.join(PKG_ROOT, 'scripts', scriptName)
  if (!existsSync(script)) {
    console.error(`Missing ${script}`)
    process.exit(1)
  }
  const child = spawn(process.execPath, [script, ...scriptArgs], {
    cwd: PKG_ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  const result = await waitForChild(child)
  if ('signal' in result && result.signal) process.kill(process.pid, result.signal)
  else process.exit(result.code ?? 0)
}

async function delegateToWindowsPs1(argv) {
  const ps1 = path.join(PKG_ROOT, 'bin', 'blink.ps1')
  if (!existsSync(ps1)) {
    return false
  }
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, ...argv],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        BLINK_WIN_PS_LAUNCH: '1',
        BLINK_INVOKE_CWD: process.env.BLINK_INVOKE_CWD || process.cwd(),
      },
    },
  )
  const result = await waitForChild(child)
  if ('signal' in result && result.signal) process.kill(process.pid, result.signal)
  else process.exit(result.code ?? 0)
  return true
}

const CLI_SUBCOMMANDS = new Set([
  'setup',
  'doctor',
  'bench',
  'auth',
  'provider',
  'config',
  'models',
  'sessions',
])

const WORKFLOW_COMMANDS = new Set(['ask', 'review', 'fix', 'plan'])

function isCliOnlyInvocation(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return true
  if (
    argv.length === 1 &&
    (argv[0] === '--version' || argv[0] === '-v' || argv[0] === '-V')
  ) {
    return true
  }
  const sub = argv[0]
  if (sub && CLI_SUBCOMMANDS.has(sub)) return true
  if (sub === 'ask') return argv.length < 2
  if (WORKFLOW_COMMANDS.has(sub)) return argv.length < 2
  return false
}

/** npm runs node→bun on Windows, which breaks Ink raw mode; ps1 runs bun in-process. */
function shouldDelegateToWindowsPs1(argv) {
  if (process.platform !== 'win32') return false
  if (process.env.BLINK_WIN_PS_LAUNCH === '1') return false
  // Launcher-only npm package has no cli.tsx — ps1 would error; use node fallback.
  if (isLauncherOnlyInstall(PKG_ROOT)) return false
  if (isCliOnlyInvocation(argv)) return false
  if (argv.includes('-p') || argv.includes('--print')) return false
  return true
}

async function main() {
  let args = process.argv.slice(2)
  const globalFlags = parseGlobalCliFlags(args)
  args = globalFlags.argv
  if (globalFlags.json) process.env.BLINK_JSON = '1'
  // Remember where the user launched blink so the agent and any spawned
  // window operate on that folder (not the package checkout).
  // Always sync to this invocation's shell cwd (ignore stale session env).
  process.env.BLINK_INVOKE_CWD = process.cwd()

  if (WORKFLOW_COMMANDS.has(args[0])) {
    const kind = args[0]
    const rest = args.slice(1)
    if (rest.length === 0) {
      console.error(`Usage: blink ${kind} <${kind === 'ask' ? 'question' : 'scope'}>`)
      console.error(`Example: blink ${kind} "${kind === 'review' ? 'uncommitted changes' : kind === 'plan' ? 'add auth module' : 'fix failing tests'}"`)
      process.exit(EXIT.USAGE)
    }
    args = buildWorkflowPrintArgs(kind, rest)
  }

  if ((args[0] === '-p' || args[0] === '--print') && !resolveActive()) {
    console.error(
      'No API key configured.\n\n' +
        '  blink auth login --key <your_key>\n' +
        '  blink setup\n\n' +
        'Verify: blink config',
    )
    process.exit(EXIT.ERROR)
  }

  if (args.includes('--in-window')) {
    process.env.BLINK_IN_WINDOW = '1'
    args = stripInWindowFlag(args)
  }

  if (shouldOpenNewWindow(args)) {
    if (spawnBlinkInNewWindow(args)) {
      return
    }
  }

  args = stripAllowHomeFlag(args)

  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    printHelp()
    return
  }

  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v' || args[0] === '-V')) {
    console.log(`${BLINK_VERSION} (${BLINK_PRODUCT_NAME})`)
    return
  }

  if (args[0] === 'sessions') {
    await runNodeScript('blink-sessions-cli.js', args.slice(1))
    return
  }

  if (args[0] === 'config') {
    await runNodeScript('blink-config-cli.js')
    return
  }

  if (args[0] === 'bench') {
    await runNodeScript('blink-bench-cli.js', args.slice(1))
    return
  }

  if (args[0] === 'models') {
    await runNodeScript('blink-provider-cli.js', ['models', args[1]].filter(Boolean))
    return
  }

  if (args[0] === 'setup' || args[0] === 'doctor') {
    process.env.BLINK_DOCTOR_INVOKED_AS = args[0]
    await runNodeScript('blink-doctor.js')
    return
  }

  if (args[0] === 'provider') {
    await runNodeScript('blink-provider-cli.js', args.slice(1))
    return
  }

  if (args[0] === 'auth' && (args[1] === '--help' || args[1] === '-h')) {
    printAuthLoginHelp()
    return
  }

  if (args[0] === 'auth' && args[1] === 'login') {
    const keyIdx = args.indexOf('--key')
    const provIdx = args.indexOf('--provider')
    if (keyIdx >= 0 && keyIdx + 1 < args.length) {
      const key = args[keyIdx + 1]
      const scriptArgs =
        provIdx >= 0 && provIdx + 1 < args.length
          ? [args[provIdx + 1], key]
          : [key]
      await runNodeScript('blink-save-api-key.js', scriptArgs)
      return
    }
    console.error('Usage: blink auth login [--provider <id>] --key <your_key>')
    console.error('Run: blink auth login --help')
    process.exit(EXIT.USAGE)
  }

  if (shouldDelegateToWindowsPs1(args)) {
    await delegateToWindowsPs1(args)
    return
  }

  Object.assign(process.env, blinkChildEnv(args))

  const launcherOnly = isLauncherOnlyInstall(PKG_ROOT)
  const launchArgs = launcherOnly ? applyLauncherDefaultArgs(args, true) : args

  const cliEntry = resolveBlinkCliEntry(PKG_ROOT)
  if (!cliEntry) {
    const fallback = path.join(PKG_ROOT, 'scripts', 'blink-run-claude.js')
    if (existsSync(fallback)) {
      if (process.stderr.isTTY) {
        console.error(
          'Starting Blink (fast mode). Use blink --full for plugins/MCP.',
        )
      }
      const child = spawn(process.execPath, [fallback, ...launchArgs], {
        cwd: process.env.BLINK_INVOKE_CWD || process.cwd(),
        stdio: 'inherit',
        env: {
          ...process.env,
          BLINK_LAUNCHER_ONLY: '1',
          CLAUDE_CODE_SIMPLE: launchArgs.includes('--bare') ? '1' : process.env.CLAUDE_CODE_SIMPLE,
        },
      })
      const result = await waitForChild(child)
      if ('signal' in result && result.signal) process.kill(process.pid, result.signal)
      else process.exit(result.code ?? 0)
      return
    }
    console.error(
      'Blink source not found (missing entrypoints/cli.tsx).\n' +
        'Run blink from the blinkcode repository checkout, not the minimal npm wrapper alone.\n' +
        'Install Bun: https://bun.sh',
    )
    process.exit(1)
  }

  const bunCmd = assertBunAvailable()

  if (process.stderr.isTTY && isInteractiveLaunch(launchArgs) && !isQuiet()) {
    prepareWindowsTuiConsole()
    if (blinkWarmNeeded()) {
      startBlinkStartupLoader('compile')
      const warmCode = await runBlinkWarm()
      // Clear parent loader before Bun child owns stderr (avoid double animation).
      // Keep cursor hidden so the brief handoff does not invite typing.
      stopBlinkStartupLoader({ keepCursorHidden: true })
      if (warmCode === 0) {
        process.env.BLINK_CACHE_WARMED = '1'
      } else {
        console.error(
          'Compile prep failed; Blink will compile on launch (please wait).\n',
        )
      }
    } else {
      process.env.BLINK_CACHE_WARMED = '1'
    }
    // Child Bun process shows the animated loader through interactive boot.
  } else if (process.stderr.isTTY && !isQuiet()) {
    const fullMode = launchArgs.includes('--full')
    console.error(
      fullMode
        ? 'Starting Blink (full mode — loading plugins; first compile may take several minutes)...'
        : 'Starting Blink...',
    )
  }

  delete process.env.CLAUDE_CODE_OAUTH_TOKEN

  // Prep runs in a child process — apply resolved credentials here so
  // blinkChildEnv() does not inherit a stale ANTHROPIC_AUTH_TOKEN / API_KEY.
  Object.assign(process.env, buildBlinkChildAuthEnv())

  process.title = TITLE
  const titleTimer =
    process.platform === 'win32'
      ? setInterval(() => {
          process.title = TITLE
        }, TITLE_REFRESH_MS)
      : null

  const cliArgs = buildCliArgs(launchArgs)
  const childEnv = {
    ...blinkChildEnv(cliArgs),
    ...buildBlinkChildAuthEnv(),
  }

  // Bun must run with cwd = package root so bunfig.toml preload (MACRO, aliases)
  // loads. cli.tsx chdirs to BLINK_INVOKE_CWD before app state initializes.
  const child = spawn(bunCmd, [cliEntry, ...cliArgs], {
    cwd: PKG_ROOT,
    stdio: 'inherit',
    env: childEnv,
    windowsHide: false,
  })

  try {
    const result = await waitForChild(child)
    if (titleTimer) clearInterval(titleTimer)
    if ('signal' in result && result.signal) process.kill(process.pid, result.signal)
    else process.exit(result.code ?? 0)
  } catch (err) {
    if (titleTimer) clearInterval(titleTimer)
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

await main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})

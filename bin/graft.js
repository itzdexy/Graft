#!/usr/bin/env node
import '../scripts/graft-env.js'
/**
 * graftcode — cross-platform npm entry (Windows, macOS, Linux).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { GRAFT_PRODUCT_NAME, GRAFT_VERSION } from '../src/constants/graft.js'
import {
  getGraftPackageRoot,
  resolveGraftCliEntry,
  assertBunAvailable,
} from '../scripts/graft-package-root.js'
import {
  getGraftRuntimeEntry,
  runGraftWarm,
  graftWarmNeeded,
} from '../scripts/graft-warm.js'
import {
  startGraftStartupLoader,
  stopGraftStartupLoader,
} from '../scripts/graft-startup-loader.js'
import { buildGraftChildAuthEnv } from '../scripts/graft-prep-auth.js'
import {
  applyLauncherDefaultArgs,
  isLauncherOnlyInstall,
  stripAllowHomeFlag,
} from '../scripts/graft-launch-hints.js'
import {
  isQuiet,
  parseGlobalCliFlags,
  printAuthLoginHelp,
  printMainHelp,
  EXIT,
} from '../scripts/graft-cli-ux.js'
import { buildWorkflowPrintArgs } from '../scripts/graft-workflow-prompts.js'
import {
  resolveActive,
  setActiveProvider,
  setProviderAuth,
} from '../scripts/graft-providers.js'
import {
  shouldOpenNewWindow,
  spawnGraftInNewWindow,
  stripInWindowFlag,
  prepareWindowsTuiConsole,
} from '../scripts/graft-windows-launcher.js'

const PKG_ROOT = getGraftPackageRoot()

const TITLE = GRAFT_PRODUCT_NAME
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
  // Skip scanning 100+ Graft plugins on every launch (can hang 10+ min on Windows).
  if (!args.includes('--bare')) {
    args = ['--bare', ...args]
  }
  return args
}

function isGraftFastLaunch(argv) {
  return !argv.includes('--full')
}

function isInteractiveLaunch(argv) {
  if (argv.includes('-p') || argv.includes('--print')) return false
  if (argv.includes('--help') || argv.includes('-h')) return false
  if (argv.includes('--version') || argv.includes('-v') || argv.includes('-V')) return false
  if (argv.length >= 1 && CLI_SUBCOMMANDS.has(argv[0])) {
    return false
  }
  return true
}

function graftChildEnv(argv) {
  const useFast = isGraftFastLaunch(argv)
  const env = {
    ...process.env,
    GRAFT_PACKAGE_ROOT: PKG_ROOT,
    GRAFT_SRC: PKG_ROOT,
    GRAFT_FORCE_INTERACTIVE: '1',
    // Alt-screen renderer: resize-safe UI (main-screen redraw ghosts on Windows).
    GRAFT_CODE_NO_FLICKER: process.env.GRAFT_CODE_NO_FLICKER ?? '1',
    // DA1/XTVERSION probes leak as visible escape garbage on Windows fullscreen.
    ...(process.platform === 'win32'
      ? { GRAFT_SKIP_TERMINAL_QUERIES: '1' }
      : {}),
  }
  if (useFast) {
    env.GRAFT_CODE_SIMPLE = '1'
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

async function runBunScript(scriptName, scriptArgs = []) {
  const script = path.join(PKG_ROOT, 'scripts', scriptName)
  if (!existsSync(script)) {
    console.error(`Missing ${script}`)
    process.exit(1)
  }
  const child = spawn(assertBunAvailable(), [script, ...scriptArgs], {
    cwd: PKG_ROOT,
    stdio: 'inherit',
    env: graftChildEnv([]),
  })
  const result = await waitForChild(child)
  if ('signal' in result && result.signal) process.kill(process.pid, result.signal)
  else if (result.code !== 0) process.exit(result.code ?? 1)
}

const EXTERNAL_ACCOUNT_LOGINS = {
  codex: {
    command: 'codex',
    args: ['login'],
    label: 'OpenAI Codex',
  },
  'gemini-cli': {
    command: 'gemini',
    args: [],
    label: 'Gemini CLI',
  },
  'claude-subscription': {
    script: 'graft-anthropic-login.ts',
    label: 'Anthropic',
  },
}

async function runExternalAccountLogin(id, extraArgs = []) {
  const target = EXTERNAL_ACCOUNT_LOGINS[id]
  if (!target) return false
  if (target.script) {
    await runBunScript(target.script, extraArgs)
    return true
  }
  console.log(
    `Opening the official ${target.label} login. Graft will not copy or import its credentials.`,
  )
  const child = spawn(target.command, target.args, {
    cwd: process.env.GRAFT_INVOKE_CWD || process.cwd(),
    stdio: 'inherit',
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          !/^(?:ANTHROPIC_|GRAFT_CODE_|GRAFT_ACTIVE_PROVIDER$|GRAFT_PROVIDER_AUTH_MODE$)/.test(
            key,
          ),
      ),
    ),
    shell: process.platform === 'win32',
  })
  try {
    const result = await waitForChild(child)
    if ('signal' in result && result.signal) {
      process.kill(process.pid, result.signal)
      return true
    }
    if (result.code !== 0) {
      process.exit(result.code ?? 1)
    }
    if (id === 'codex') {
      setProviderAuth('openai', 'oauth')
      setActiveProvider('openai')
      console.log(
        'ChatGPT connected to Graft through the official Codex CLI. Run graft, then /model to choose a GPT model.',
      )
    } else {
      console.log(`${target.label} login finished.`)
    }
  } catch {
    console.error(
      `${target.label} is not installed or could not start. Install its official CLI, then retry.`,
    )
    process.exit(EXIT.ERROR)
  }
  return true
}

async function delegateToWindowsPs1(argv) {
  const ps1 = path.join(PKG_ROOT, 'bin', 'graft.ps1')
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
        GRAFT_WIN_PS_LAUNCH: '1',
        GRAFT_INVOKE_CWD: process.env.GRAFT_INVOKE_CWD || process.cwd(),
        GRAFT_INVOKE_CWD_LOCKED: '1',
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
  'serve',
  'mcp',
  'providers',
  'launch',
  'apps',
  'codex',
  'claude',
  'claude-code',
  'claude-desktop',
  'chatgpt',
  'chatgpt-desktop',
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
  if (process.env.GRAFT_WIN_PS_LAUNCH === '1') return false
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
  if (globalFlags.json) process.env.GRAFT_JSON = '1'
  // Remember where the user launched Graft so the agent and any spawned
  // window operate on that folder (not the package checkout). An outer
  // installer/global shim locks the value before it changes directories.
  if (
    process.env.GRAFT_INVOKE_CWD_LOCKED !== '1' ||
    !process.env.GRAFT_INVOKE_CWD
  ) {
    process.env.GRAFT_INVOKE_CWD = process.cwd()
    process.env.GRAFT_INVOKE_CWD_LOCKED = '1'
  }

  if (WORKFLOW_COMMANDS.has(args[0])) {
    const kind = args[0]
    const rest = args.slice(1)
    if (rest.length === 0) {
      const noun = kind === 'ask' ? 'question' : 'scope'
      const examples = {
        ask: 'Example: graft ask "summarize this repository"',
        review: 'Example: graft review "uncommitted changes"',
        fix: 'Example: graft fix "failing unit tests"',
        plan: 'Example: graft plan "add OAuth login"',
      }
      console.error(`Usage: graft ${kind} <${noun}>`)
      console.error(examples[kind])
      process.exit(EXIT.USAGE)
    }
    args = buildWorkflowPrintArgs(kind, rest)
  }

  if ((args[0] === '-p' || args[0] === '--print') && !resolveActive()) {
    console.error(
      'No API key configured.\n\n' +
        '  graft auth login --key <your_key>\n' +
        '  graft setup\n\n' +
        'Verify: graft config',
    )
    process.exit(EXIT.ERROR)
  }

  if (args.includes('--in-window')) {
    process.env.GRAFT_IN_WINDOW = '1'
    args = stripInWindowFlag(args)
  }

  if (shouldOpenNewWindow(args)) {
    if (spawnGraftInNewWindow(args)) {
      return
    }
  }

  args = stripAllowHomeFlag(args)

  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    printHelp()
    return
  }

  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v' || args[0] === '-V')) {
    console.log(`${GRAFT_VERSION} (${GRAFT_PRODUCT_NAME})`)
    return
  }

  if (args[0] === 'sessions') {
    await runNodeScript('graft-sessions-cli.js', args.slice(1))
    return
  }

  if (args[0] === 'config') {
    await runNodeScript('graft-config-cli.js')
    return
  }

  if (args[0] === 'bench') {
    await runNodeScript('graft-bench-cli.js', args.slice(1))
    return
  }

  if (args[0] === 'models') {
    await runNodeScript('graft-provider-cli.js', ['models', args[1]].filter(Boolean))
    return
  }

  if (args[0] === 'setup' || args[0] === 'doctor') {
    process.env.GRAFT_DOCTOR_INVOKED_AS = args[0]
    await runNodeScript('graft-doctor.js')
    return
  }

  if (args[0] === 'provider') {
    await runNodeScript('graft-provider-cli.js', args.slice(1))
    return
  }

  // Friendly plural/verb aliases from the platform docs. Keep one provider
  // CLI and one app launcher so aliases cannot create a second config system.
  if (args[0] === 'providers') {
    await runNodeScript('graft-provider-cli.js', args.slice(1))
    return
  }

  // Third-party app launch/configuration stays in the lightweight Node
  // launcher. It can choose a connected Graft model before Ink starts.
  if (
    ['launch', 'apps', 'codex', 'claude', 'claude-code', 'claude-desktop', 'chatgpt', 'chatgpt-desktop'].includes(
      args[0],
    )
  ) {
    if (args[0] === 'launch') process.env.GRAFT_APP_LAUNCH = '1'
    await runNodeScript('graft-app-cli.js', args[0] === 'launch' ? args.slice(1) : args)
    return
  }

  if (args[0] === 'auth' && (args[1] === '--help' || args[1] === '-h')) {
    printAuthLoginHelp()
    return
  }

  if (args[0] === 'auth' && args[1] === 'login') {
    const keyIdx = args.indexOf('--key')
    const provIdx = args.indexOf('--provider')
    const provider =
      provIdx >= 0 && provIdx + 1 < args.length ? args[provIdx + 1] : ''
    if (
      provider &&
      (await runExternalAccountLogin(
        provider,
        args.includes('--help') || args.includes('-h') ? ['--help'] : [],
      ))
    ) {
      return
    }
    if (keyIdx >= 0 && keyIdx + 1 < args.length) {
      const key = args[keyIdx + 1]
      const scriptArgs =
        provIdx >= 0 && provIdx + 1 < args.length
          ? [provider, key]
          : [key]
      await runNodeScript('graft-save-api-key.js', scriptArgs)
      return
    }
    console.error('Usage: graft auth login [--provider <id>] --key <your_key>')
    console.error('Run: graft auth login --help')
    process.exit(EXIT.USAGE)
  }

  if (shouldDelegateToWindowsPs1(args)) {
    await delegateToWindowsPs1(args)
    return
  }

  Object.assign(process.env, graftChildEnv(args))

  const launcherOnly = isLauncherOnlyInstall(PKG_ROOT)
  const launchArgs = launcherOnly ? applyLauncherDefaultArgs(args, true) : args

  let cliEntry = resolveGraftCliEntry(PKG_ROOT)
  if (!cliEntry) {
    console.error(
      'Graft source not found (missing src/entrypoints/cli.tsx).\n' +
        'Graft will not fall back to, patch, or launch another AI CLI.\n' +
        'Install the complete graftcode package or run from its source checkout.\n' +
        'Install Bun: https://bun.sh',
    )
    process.exit(1)
  }

  const bunCmd = assertBunAvailable()

  if (process.stderr.isTTY && isInteractiveLaunch(launchArgs) && !isQuiet()) {
    prepareWindowsTuiConsole()
    if (graftWarmNeeded()) {
      startGraftStartupLoader('compile')
      const warmCode = await runGraftWarm()
      // Clear parent loader before Bun child owns stderr (avoid double animation).
      // Keep cursor hidden so the brief handoff does not invite typing.
      stopGraftStartupLoader({ keepCursorHidden: true })
      if (warmCode === 0) {
        process.env.GRAFT_CACHE_WARMED = '1'
      } else {
        console.error(
          'Compile prep failed; Graft will compile on launch (please wait).\n',
        )
      }
    } else {
      process.env.GRAFT_CACHE_WARMED = '1'
    }
    // Child Bun process shows the animated loader through interactive boot.
  } else if (process.stderr.isTTY && !isQuiet()) {
    const fullMode = launchArgs.includes('--full')
    console.error(
      fullMode
        ? 'Starting Graft (full mode — loading plugins; first compile may take several minutes)...'
        : 'Starting Graft...',
    )
  }

  if (isGraftFastLaunch(launchArgs)) {
    cliEntry = getGraftRuntimeEntry() ?? cliEntry
  }

  delete process.env.GRAFT_CODE_OAUTH_TOKEN

  // Prep runs in a child process — apply resolved credentials here so
  // graftChildEnv() does not inherit a stale ANTHROPIC_AUTH_TOKEN / API_KEY.
  Object.assign(process.env, buildGraftChildAuthEnv())

  process.title = TITLE
  const titleTimer =
    process.platform === 'win32'
      ? setInterval(() => {
          process.title = TITLE
        }, TITLE_REFRESH_MS)
      : null

  const cliArgs = buildCliArgs(launchArgs)
  const childEnv = {
    ...graftChildEnv(cliArgs),
    ...buildGraftChildAuthEnv(),
  }

  // Bun must run with cwd = package root so bunfig.toml preload (MACRO, aliases)
  // loads. cli.tsx chdirs to GRAFT_INVOKE_CWD before app state initializes.
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

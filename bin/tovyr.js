#!/usr/bin/env node
/**
 * tovyrcode — cross-platform npm entry (Windows, macOS, Linux).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { TOVYR_PRODUCT_NAME, TOVYR_VERSION } from '../src/constants/tovyr.js'
import {
  getTovyrPackageRoot,
  resolveTovyrCliEntry,
  assertBunAvailable,
} from '../scripts/tovyr-package-root.js'
import {
  getTovyrRuntimeEntry,
  runTovyrWarm,
  tovyrWarmNeeded,
} from '../scripts/tovyr-warm.js'
import {
  startTovyrStartupLoader,
  stopTovyrStartupLoader,
} from '../scripts/tovyr-startup-loader.js'
import { buildTovyrChildAuthEnv } from '../scripts/tovyr-prep-auth.js'
import {
  applyLauncherDefaultArgs,
  isLauncherOnlyInstall,
  stripAllowHomeFlag,
} from '../scripts/tovyr-launch-hints.js'
import {
  isQuiet,
  parseGlobalCliFlags,
  printAuthLoginHelp,
  printMainHelp,
  EXIT,
} from '../scripts/tovyr-cli-ux.js'
import { buildWorkflowPrintArgs } from '../scripts/tovyr-workflow-prompts.js'
import {
  resolveActive,
  setActiveProvider,
  setProviderAuth,
} from '../scripts/tovyr-providers.js'
import {
  shouldOpenNewWindow,
  spawnTovyrInNewWindow,
  stripInWindowFlag,
  prepareWindowsTuiConsole,
} from '../scripts/tovyr-windows-launcher.js'

const PKG_ROOT = getTovyrPackageRoot()

const TITLE = TOVYR_PRODUCT_NAME
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
  // Skip scanning 100+ Tovyr plugins on every launch (can hang 10+ min on Windows).
  if (!args.includes('--bare')) {
    args = ['--bare', ...args]
  }
  return args
}

function isTovyrFastLaunch(argv) {
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

function tovyrChildEnv(argv) {
  const useFast = isTovyrFastLaunch(argv)
  const env = {
    ...process.env,
    TOVYR_PACKAGE_ROOT: PKG_ROOT,
    TOVYR_SRC: PKG_ROOT,
    TOVYR_FORCE_INTERACTIVE: '1',
    // Alt-screen renderer: resize-safe UI (main-screen redraw ghosts on Windows).
    TOVYR_CODE_NO_FLICKER: process.env.TOVYR_CODE_NO_FLICKER ?? '1',
    // DA1/XTVERSION probes leak as visible escape garbage on Windows fullscreen.
    ...(process.platform === 'win32'
      ? { TOVYR_SKIP_TERMINAL_QUERIES: '1' }
      : {}),
  }
  if (useFast) {
    env.TOVYR_CODE_SIMPLE = '1'
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
    env: tovyrChildEnv([]),
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
    script: 'tovyr-anthropic-login.ts',
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
    `Opening the official ${target.label} login. Tovyr will not copy or import its credentials.`,
  )
  const child = spawn(target.command, target.args, {
    cwd: process.env.TOVYR_INVOKE_CWD || process.cwd(),
    stdio: 'inherit',
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          !/^(?:ANTHROPIC_|TOVYR_CODE_|TOVYR_ACTIVE_PROVIDER$|TOVYR_PROVIDER_AUTH_MODE$)/.test(
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
        'ChatGPT connected to Tovyr through the official Codex CLI. Run tovyr, then /model to choose a GPT model.',
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
  const ps1 = path.join(PKG_ROOT, 'bin', 'tovyr.ps1')
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
        TOVYR_WIN_PS_LAUNCH: '1',
        TOVYR_INVOKE_CWD: process.env.TOVYR_INVOKE_CWD || process.cwd(),
        TOVYR_INVOKE_CWD_LOCKED: '1',
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
  if (process.env.TOVYR_WIN_PS_LAUNCH === '1') return false
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
  if (globalFlags.json) process.env.TOVYR_JSON = '1'
  // Remember where the user launched Tovyr so the agent and any spawned
  // window operate on that folder (not the package checkout). An outer
  // installer/global shim locks the value before it changes directories.
  if (
    process.env.TOVYR_INVOKE_CWD_LOCKED !== '1' ||
    !process.env.TOVYR_INVOKE_CWD
  ) {
    process.env.TOVYR_INVOKE_CWD = process.cwd()
    process.env.TOVYR_INVOKE_CWD_LOCKED = '1'
  }

  if (WORKFLOW_COMMANDS.has(args[0])) {
    const kind = args[0]
    const rest = args.slice(1)
    if (rest.length === 0) {
      const noun = kind === 'ask' ? 'question' : 'scope'
      const examples = {
        ask: 'Example: tovyr ask "summarize this repository"',
        review: 'Example: tovyr review "uncommitted changes"',
        fix: 'Example: tovyr fix "failing unit tests"',
        plan: 'Example: tovyr plan "add OAuth login"',
      }
      console.error(`Usage: tovyr ${kind} <${noun}>`)
      console.error(examples[kind])
      process.exit(EXIT.USAGE)
    }
    args = buildWorkflowPrintArgs(kind, rest)
  }

  if ((args[0] === '-p' || args[0] === '--print') && !resolveActive()) {
    console.error(
      'No API key configured.\n\n' +
        '  tovyr auth login --key <your_key>\n' +
        '  tovyr setup\n\n' +
        'Verify: tovyr config',
    )
    process.exit(EXIT.ERROR)
  }

  if (args.includes('--in-window')) {
    process.env.TOVYR_IN_WINDOW = '1'
    args = stripInWindowFlag(args)
  }

  if (shouldOpenNewWindow(args)) {
    if (spawnTovyrInNewWindow(args)) {
      return
    }
  }

  args = stripAllowHomeFlag(args)

  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    printHelp()
    return
  }

  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v' || args[0] === '-V')) {
    console.log(`${TOVYR_VERSION} (${TOVYR_PRODUCT_NAME})`)
    return
  }

  if (args[0] === 'sessions') {
    await runNodeScript('tovyr-sessions-cli.js', args.slice(1))
    return
  }

  if (args[0] === 'config') {
    await runNodeScript('tovyr-config-cli.js')
    return
  }

  if (args[0] === 'bench') {
    await runNodeScript('tovyr-bench-cli.js', args.slice(1))
    return
  }

  if (args[0] === 'models') {
    await runNodeScript('tovyr-provider-cli.js', ['models', args[1]].filter(Boolean))
    return
  }

  if (args[0] === 'setup' || args[0] === 'doctor') {
    process.env.TOVYR_DOCTOR_INVOKED_AS = args[0]
    await runNodeScript('tovyr-doctor.js')
    return
  }

  if (args[0] === 'provider') {
    await runNodeScript('tovyr-provider-cli.js', args.slice(1))
    return
  }

  // Friendly plural/verb aliases from the platform docs. Keep one provider
  // CLI and one app launcher so aliases cannot create a second config system.
  if (args[0] === 'providers') {
    await runNodeScript('tovyr-provider-cli.js', args.slice(1))
    return
  }

  // Third-party app launch/configuration stays in the lightweight Node
  // launcher. It can choose a connected Tovyr model before Ink starts.
  if (
    ['launch', 'apps', 'codex', 'claude', 'claude-code', 'claude-desktop', 'chatgpt', 'chatgpt-desktop'].includes(
      args[0],
    )
  ) {
    if (args[0] === 'launch') process.env.TOVYR_APP_LAUNCH = '1'
    await runNodeScript('tovyr-app-cli.js', args[0] === 'launch' ? args.slice(1) : args)
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
      await runNodeScript('tovyr-save-api-key.js', scriptArgs)
      return
    }
    console.error('Usage: tovyr auth login [--provider <id>] --key <your_key>')
    console.error('Run: tovyr auth login --help')
    process.exit(EXIT.USAGE)
  }

  if (shouldDelegateToWindowsPs1(args)) {
    await delegateToWindowsPs1(args)
    return
  }

  Object.assign(process.env, tovyrChildEnv(args))

  const launcherOnly = isLauncherOnlyInstall(PKG_ROOT)
  const launchArgs = launcherOnly ? applyLauncherDefaultArgs(args, true) : args

  let cliEntry = resolveTovyrCliEntry(PKG_ROOT)
  if (!cliEntry) {
    console.error(
      'Tovyr source not found (missing src/entrypoints/cli.tsx).\n' +
        'Tovyr will not fall back to, patch, or launch another AI CLI.\n' +
        'Install the complete tovyrcode package or run from its source checkout.\n' +
        'Install Bun: https://bun.sh',
    )
    process.exit(1)
  }

  const bunCmd = assertBunAvailable()

  if (process.stderr.isTTY && isInteractiveLaunch(launchArgs) && !isQuiet()) {
    prepareWindowsTuiConsole()
    if (tovyrWarmNeeded()) {
      startTovyrStartupLoader('compile')
      const warmCode = await runTovyrWarm()
      // Clear parent loader before Bun child owns stderr (avoid double animation).
      // Keep cursor hidden so the brief handoff does not invite typing.
      stopTovyrStartupLoader({ keepCursorHidden: true })
      if (warmCode === 0) {
        process.env.TOVYR_CACHE_WARMED = '1'
      } else {
        console.error(
          'Compile prep failed; Tovyr will compile on launch (please wait).\n',
        )
      }
    } else {
      process.env.TOVYR_CACHE_WARMED = '1'
    }
    // Child Bun process shows the animated loader through interactive boot.
  } else if (process.stderr.isTTY && !isQuiet()) {
    const fullMode = launchArgs.includes('--full')
    console.error(
      fullMode
        ? 'Starting Tovyr (full mode — loading plugins; first compile may take several minutes)...'
        : 'Starting Tovyr...',
    )
  }

  if (isTovyrFastLaunch(launchArgs)) {
    cliEntry = getTovyrRuntimeEntry() ?? cliEntry
  }

  delete process.env.TOVYR_CODE_OAUTH_TOKEN

  // Prep runs in a child process — apply resolved credentials here so
  // tovyrChildEnv() does not inherit a stale ANTHROPIC_AUTH_TOKEN / API_KEY.
  Object.assign(process.env, buildTovyrChildAuthEnv())

  process.title = TITLE
  const titleTimer =
    process.platform === 'win32'
      ? setInterval(() => {
          process.title = TITLE
        }, TITLE_REFRESH_MS)
      : null

  const cliArgs = buildCliArgs(launchArgs)
  const childEnv = {
    ...tovyrChildEnv(cliArgs),
    ...buildTovyrChildAuthEnv(),
  }

  // Bun must run with cwd = package root so bunfig.toml preload (MACRO, aliases)
  // loads. cli.tsx chdirs to TOVYR_INVOKE_CWD before app state initializes.
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

import '../../scripts/graft-env.js'
import { feature } from '../utils/features.js'

// Keep the Bun-hosted source runtime identifiable in process inspectors that
// honor the process title. Task Manager's icon remains a property of bun.exe.
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.title = 'Graft'

// Bugfix for corepack auto-pinning, which adds yarnpkg to peoples' package.jsons
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.env.COREPACK_ENABLE_AUTO_PIN = '0'

// Source checkouts are still end-user CLI launches. Default React/Ink to
// production so each client avoids development validation and devtools work.
// An explicit NODE_ENV remains available for contributors debugging the UI.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production'

// Some OpenAI-compatible providers accept the request but leave the SSE body
// silent. Keep an interactive Graft session recoverable by default.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (!process.env.CLAUDE_ENABLE_STREAM_WATCHDOG) {
  process.env.CLAUDE_ENABLE_STREAM_WATCHDOG = '1'
}
// Prefer GRAFT_STREAM_IDLE_TIMEOUT_MS; fall back to Claude env; default 45s.
// Silent OpenAI-compat streams (and models that only emit reasoning we used to
// drop) should fail over faster than two minutes of "Still no response".
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (process.env.GRAFT_STREAM_IDLE_TIMEOUT_MS && !process.env.CLAUDE_STREAM_IDLE_TIMEOUT_MS) {
  process.env.CLAUDE_STREAM_IDLE_TIMEOUT_MS = process.env.GRAFT_STREAM_IDLE_TIMEOUT_MS
}
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (!process.env.CLAUDE_STREAM_IDLE_TIMEOUT_MS) {
  process.env.CLAUDE_STREAM_IDLE_TIMEOUT_MS = '45000'
}
// Retrying the same silent request as non-streaming only doubles the wait and
// can duplicate partially emitted tool calls.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (!process.env.GRAFT_CODE_DISABLE_NONSTREAMING_FALLBACK) {
  process.env.GRAFT_CODE_DISABLE_NONSTREAMING_FALLBACK = '1'
}

// When the Windows ps1 launcher spawns Bun as a child process, Bun reports
// stdout.isTTY=false even on a real ConHost/WT console because the handle is
// inherited from a non-TTY pipe context. GRAFT_FORCE_INTERACTIVE=1 is set by
// the launcher explicitly to signal "this IS a real interactive terminal, trust us".
// We must patch isTTY before ANY module import so Ink's TTY guards all pass.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (process.env.GRAFT_FORCE_INTERACTIVE === '1') {
  // eslint-disable-next-line custom-rules/no-top-level-side-effects
  if (!process.stdout.isTTY) {
    // @ts-ignore — intentional runtime override for Windows launcher compat
    process.stdout.isTTY = true
  }
  // eslint-disable-next-line custom-rules/no-top-level-side-effects
  if (!process.stderr.isTTY) {
    // @ts-ignore — intentional runtime override for Windows launcher compat
    process.stderr.isTTY = true
  }
  // eslint-disable-next-line custom-rules/no-top-level-side-effects
  if (!process.stdin.isTTY) {
    // @ts-ignore — intentional runtime override for Windows launcher compat
    process.stdin.isTTY = true
  }
}

// Set max heap size for child processes in CCR environments (containers have 16GB)
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level, custom-rules/safe-env-boolean-check
if (process.env.GRAFT_CODE_REMOTE === 'true') {
  // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
  const existing = process.env.NODE_OPTIONS || ''
  // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
  process.env.NODE_OPTIONS = existing
    ? `${existing} --max-old-space-size=8192`
    : '--max-old-space-size=8192'
}

// Harness-science L0 ablation baseline. Inlined here (not init.ts) because
// BashTool/AgentTool/PowerShellTool capture DISABLE_BACKGROUND_TASKS into
// module-level consts at import time — init() runs too late. feature() gate
// DCEs this entire block from external builds.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (feature('ABLATION_BASELINE') && process.env.GRAFT_CODE_ABLATION_BASELINE) {
  for (const k of [
    'GRAFT_CODE_SIMPLE',
    'GRAFT_CODE_DISABLE_THINKING',
    'DISABLE_INTERLEAVED_THINKING',
    'DISABLE_COMPACT',
    'DISABLE_AUTO_COMPACT',
    'GRAFT_CODE_DISABLE_AUTO_MEMORY',
    'GRAFT_CODE_DISABLE_BACKGROUND_TASKS',
  ]) {
    // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
    process.env[k] ??= '1'
  }
}

/** Load build-gated modules that are not distributed in the public source release. */
async function importOptionalFeatureModule<T>(specifier: string): Promise<T> {
  try {
    return (await import(specifier)) as T
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : ''
    throw new Error(`Optional Graft feature is unavailable: ${specifier}.${detail}`)
  }
}

/**
 * Bootstrap entrypoint - checks for special flags before loading the full CLI.
 * All imports are dynamic to minimize module evaluation for fast paths.
 * Fast-path for --version has zero imports beyond this file.
 */
async function main(): Promise<void> {
  // The launcher runs Bun from the package root. Switch back to the shell's
  // invocation directory before any app state is initialized from cwd().
  const invokeCwd =
    process.env.GRAFT_INVOKE_CWD_LOCKED === '1'
      ? process.env.GRAFT_INVOKE_CWD
      : undefined
  if (invokeCwd) {
    try {
      process.chdir(invokeCwd)
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : ''
      throw new Error(
        `Graft could not open the folder it was launched from (${invokeCwd})${detail}`,
      )
    }
  }

  let args = process.argv.slice(2)
  let earlyInputReady = false

  const prepareEarlyInput = async (): Promise<void> => {
    if (earlyInputReady) return
    const { startCapturingEarlyInput } = await import('../utils/earlyInput.js')
    startCapturingEarlyInput()
    earlyInputReady = true
    if (
      process.env.GRAFT_PROFILE === '1' ||
      process.env.GRAFT_PROFILE === 'true'
    ) {
      process.stderr.write(
        `[graft:profile] first-input-ready: ${Math.round(process.uptime() * 1000)}ms\n`,
      )
    }
  }

  // Fast-path for cache-warm: strip the flag, exit after first render, and
  // continue through startup so Bun compiles the full module graph.
  const warmCacheIdx = args.indexOf('--warm-cache')
  if (warmCacheIdx !== -1) {
    args.splice(warmCacheIdx, 1)
    const realWarmCacheIdx = process.argv.indexOf('--warm-cache')
    if (realWarmCacheIdx !== -1) {
      process.argv.splice(realWarmCacheIdx, 1)
    }
    process.env.GRAFT_CODE_EXIT_AFTER_FIRST_RENDER = '1'
    args = process.argv.slice(2)
  }

  // Fast-path for --version/-v: zero module loading needed
  if (
    args.length === 1 &&
    (args[0] === '--version' || args[0] === '-v' || args[0] === '-V')
  ) {
    // MACRO.VERSION is inlined at build time
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`${MACRO.VERSION} (Graft)`)
    return
  }

  // Fast-path for --help/-h: avoid the heavy module graph; print a concise
  // usage summary and exit. Full option help is available via `graft --full-help`.
  if (
    args.length === 1 &&
    (args[0] === '--help' || args[0] === '-h')
  ) {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`Graft ${MACRO.VERSION}

The fast, polished AI coding agent for your terminal.

Usage:
  graft                         Start the interactive agent
  graft [prompt]                Start with a prompt
  graft ask <question>          One-shot answer (print mode)
  graft review|fix|plan <scope> Workflow one-shots (print mode)
  graft -p <prompt>             Print mode (scripting / pipes)
  graft provider list           List available providers
  graft auth login --provider <id> --key <key>
                                Connect your chosen provider
  graft --version               Print the version
  graft --help                  Show this help

Getting started:
  graft setup                   First-run checks (recommended after install)
  graft config                  Show provider, model, and paths
  graft doctor                  Diagnose install issues

Inside Graft:
  /provider                     Select a connected provider
  /model                        Select a model from that provider
  /plan                         Draft graftplan.md without editing code
  /code                         Implement the active plan
  /config                       Configure tools, reasoning, color, and motion
  /init                         Create graft.md for this project
  /help                         All slash commands

Examples:
  graft ask "summarize this repository"
  graft -p "list all TODO comments" --output-format json
  graft provider use ollama

Environment:
  GRAFT_FORCE_INTERACTIVE=1     Force the interactive UI
  GRAFT_AUTO_FAILOVER=1         Enable provider failover
  NO_COLOR=1                    Disable color

Docs: https://github.com/itzdexy/Graft`)
    return
  }

  // The overwhelmingly common `graft` path can accept keystrokes before
  // startup profiling, command registration, auth, or the loader process.
  if (args.length === 0 || args.every(arg => arg === '--bare')) {
    await prepareEarlyInput()
  }

  // For all other paths, load the startup profiler
  const { profileCheckpoint } = await import('../utils/startupProfiler.js')
  profileCheckpoint('cli_entry')

  // Fast-path for --dump-system-prompt: output the rendered system prompt and exit.
  // Used by prompt sensitivity evals to extract the system prompt at a specific commit.
  // Ant-only: eliminated from external builds via feature flag.
  if (feature('DUMP_SYSTEM_PROMPT') && args[0] === '--dump-system-prompt') {
    profileCheckpoint('cli_dump_system_prompt_path')
    const { enableConfigs } = await import('../utils/config.js')
    enableConfigs()
    const { getMainLoopModel } = await import('../utils/model/model.js')
    const modelIdx = args.indexOf('--model')
    const model = (modelIdx !== -1 && args[modelIdx + 1]) || getMainLoopModel()
    const { getSystemPrompt } = await import('../constants/prompts.js')
    const prompt = await getSystemPrompt([], model)
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(prompt.join('\n'))
    return
  }

  if (process.argv[2] === '--computer-use-mcp') {
    const { isGraftRuntime } = await import('../utils/graftRuntime.js')
    if (isGraftRuntime()) {
      process.stderr.write(
        'This foreign browser/computer host entrypoint is unavailable in Graft. Use /browser or /computer.\n',
      )
      process.exitCode = 1
      return
    }
  }

  if (
    feature('CHICAGO_MCP') &&
    process.argv[2] === '--computer-use-mcp'
  ) {
    profileCheckpoint('cli_computer_use_mcp_path')
    const { runComputerUseMcpServer } = await import(
      '../utils/computerUse/mcpServer.js'
    )
    await runComputerUseMcpServer()
    return
  }

  // Fast-path for `--daemon-worker=<kind>` (internal — supervisor spawns this).
  // Must come before the daemon subcommand check: spawned per-worker, so
  // perf-sensitive. No enableConfigs(), no analytics sinks at this layer —
  // workers are lean. If a worker kind needs configs/auth (assistant will),
  // it calls them inside its run() fn.
  if (feature('DAEMON') && args[0] === '--daemon-worker') {
    const { runDaemonWorker } = await importOptionalFeatureModule<{
      runDaemonWorker: (kind?: string) => Promise<void>
    }>('../daemon/workerRegistry.js')
    await runDaemonWorker(args[1])
    return
  }

  // Fast-path for `graft remote-control` (also accepts legacy `graft remote` / `graft sync` / `graft bridge`):
  // serve local machine as bridge environment.
  // feature() must stay inline for build-time dead code elimination;
  // isBridgeEnabled() checks the runtime GrowthBook gate.
  if (
    feature('BRIDGE_MODE') &&
    (args[0] === 'remote-control' ||
      args[0] === 'rc' ||
      args[0] === 'remote' ||
      args[0] === 'sync' ||
      args[0] === 'bridge')
  ) {
    profileCheckpoint('cli_bridge_path')
    const { enableConfigs } = await import('../utils/config.js')
    enableConfigs()

    const { getBridgeDisabledReason, checkBridgeMinVersion } = await import(
      '../bridge/bridgeEnabled.js'
    )
    const { BRIDGE_LOGIN_ERROR } = await import('../bridge/types.js')
    const { bridgeMain } = await import('../bridge/bridgeMain.js')
    const { exitWithError } = await import('../utils/process.js')

    // Auth check must come before the GrowthBook gate check — without auth,
    // GrowthBook has no user context and would return a stale/default false.
    // getBridgeDisabledReason awaits GB init, so the returned value is fresh
    // (not the stale disk cache), but init still needs auth headers to work.
    const { getGraftWebOAuthTokens } = await import('../utils/auth.js')
    if (!getGraftWebOAuthTokens()?.accessToken) {
      exitWithError(BRIDGE_LOGIN_ERROR)
    }
    const disabledReason = await getBridgeDisabledReason()
    if (disabledReason) {
      exitWithError(`Error: ${disabledReason}`)
    }
    const versionError = checkBridgeMinVersion()
    if (versionError) {
      exitWithError(versionError)
    }

    // Bridge is a remote control feature - check policy limits
    const { waitForPolicyLimitsToLoad, isPolicyAllowed } = await import(
      '../services/policyLimits/index.js'
    )
    await waitForPolicyLimitsToLoad()
    if (!isPolicyAllowed('allow_remote_control')) {
      exitWithError(
        "Error: Remote Control is disabled by your organization's policy.",
      )
    }

    await bridgeMain(args.slice(1))
    return
  }

  // Fast-path for `graft daemon [subcommand]`: long-running supervisor.
  if (feature('DAEMON') && args[0] === 'daemon') {
    profileCheckpoint('cli_daemon_path')
    const { enableConfigs } = await import('../utils/config.js')
    enableConfigs()
    const { initSinks } = await import('../utils/sinks.js')
    initSinks()
    const { daemonMain } = await importOptionalFeatureModule<{
      daemonMain: (args: string[]) => Promise<void>
    }>('../daemon/main.js')
    await daemonMain(args.slice(1))
    return
  }

  // Fast-path for `graft ps|logs|attach|kill` and `--bg`/`--background`.
  // Session management against the ~/.claude/sessions/ registry. Flag
  // literals are inlined so bg.js only loads when actually dispatching.
  if (
    feature('BG_SESSIONS') &&
    (args[0] === 'ps' ||
      args[0] === 'logs' ||
      args[0] === 'attach' ||
      args[0] === 'kill' ||
      args.includes('--bg') ||
      args.includes('--background'))
  ) {
    profileCheckpoint('cli_bg_path')
    const { enableConfigs } = await import('../utils/config.js')
    enableConfigs()
    const bg = await importOptionalFeatureModule<{
      psHandler: (args: string[]) => Promise<void>
      logsHandler: (sessionId?: string) => Promise<void>
      attachHandler: (sessionId?: string) => Promise<void>
      killHandler: (sessionId?: string) => Promise<void>
      handleBgFlag: (args: string[]) => Promise<void>
    }>('../cli/bg.js')
    switch (args[0]) {
      case 'ps':
        await bg.psHandler(args.slice(1))
        break
      case 'logs':
        await bg.logsHandler(args[1])
        break
      case 'attach':
        await bg.attachHandler(args[1])
        break
      case 'kill':
        await bg.killHandler(args[1])
        break
      default:
        await bg.handleBgFlag(args)
    }
    return
  }

  // Fast-path for template job commands.
  if (
    feature('TEMPLATES') &&
    (args[0] === 'new' || args[0] === 'list' || args[0] === 'reply')
  ) {
    profileCheckpoint('cli_templates_path')
    const { templatesMain } = await importOptionalFeatureModule<{
      templatesMain: (args: string[]) => Promise<void>
    }>('../cli/handlers/templateJobs.js')
    await templatesMain(args)
    // process.exit (not return) — mountFleetView's Ink TUI can leave event
    // loop handles that prevent natural exit.
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0)
  }

  // Fast-path for `graft environment-runner`: headless BYOC runner.
  // feature() must stay inline for build-time dead code elimination.
  if (feature('BYOC_ENVIRONMENT_RUNNER') && args[0] === 'environment-runner') {
    profileCheckpoint('cli_environment_runner_path')
    const { environmentRunnerMain } = await importOptionalFeatureModule<{
      environmentRunnerMain: (args: string[]) => Promise<void>
    }>('../environment-runner/main.js')
    await environmentRunnerMain(args.slice(1))
    return
  }

  // Fast-path for `graft self-hosted-runner`: headless self-hosted-runner
  // targeting the SelfHostedRunnerWorkerService API (register + poll; poll IS
  // heartbeat). feature() must stay inline for build-time dead code elimination.
  if (feature('SELF_HOSTED_RUNNER') && args[0] === 'self-hosted-runner') {
    profileCheckpoint('cli_self_hosted_runner_path')
    const { selfHostedRunnerMain } = await importOptionalFeatureModule<{
      selfHostedRunnerMain: (args: string[]) => Promise<void>
    }>('../self-hosted-runner/main.js')
    await selfHostedRunnerMain(args.slice(1))
    return
  }

  // Fast-path for --worktree --tmux: exec into tmux before loading full CLI
  const hasTmuxFlag = args.includes('--tmux') || args.includes('--tmux=classic')
  if (
    hasTmuxFlag &&
    (args.includes('-w') ||
      args.includes('--worktree') ||
      args.some(a => a.startsWith('--worktree=')))
  ) {
    profileCheckpoint('cli_tmux_worktree_fast_path')
    const { enableConfigs } = await import('../utils/config.js')
    enableConfigs()
    const { isWorktreeModeEnabled } = await import(
      '../utils/worktreeModeEnabled.js'
    )
    if (isWorktreeModeEnabled()) {
      const { execIntoTmuxWorktree } = await import('../utils/worktree.js')
      const result = await execIntoTmuxWorktree(args)
      if (result.handled) {
        return
      }
      // If not handled (e.g., error), fall through to normal CLI
      if (result.error) {
        const { exitWithError } = await import('../utils/process.js')
        exitWithError(result.error)
      }
    }
  }

  // Redirect common update flag mistakes to the update subcommand
  if (
    args.length === 1 &&
    (args[0] === '--update' || args[0] === '--upgrade')
  ) {
    process.argv = [process.argv[0]!, process.argv[1]!, 'update']
  }

  // --bare: set SIMPLE early so gates fire during module eval / commander
  // option building (not just inside the action handler).
  // Cache-warm also runs in SIMPLE mode so it exits quickly.
  if (args.includes('--bare')) {
    process.env.GRAFT_CODE_SIMPLE = '1'
  }

  // No special flags detected, load and run the full CLI
  // Own stdin before starting the loader child or importing the application.
  // Typed text is buffered and replayed into PromptInput when Ink mounts.
  await prepareEarlyInput()
  profileCheckpoint('cli_early_input_ready')
  const startupLoader =
    process.env.GRAFT_WARM_QUIET_LOADER === '1'
      ? null
      : await import('../utils/graftStartupLoader.js')
  startupLoader?.startGraftStartupLoader(
    process.env.GRAFT_CACHE_WARMED === '1' ? 'modules' : 'compile',
  )
  profileCheckpoint('cli_before_main_import')
  const { main: cliMain } = await import('../main.js')
  profileCheckpoint('cli_after_main_import')
  if (process.env.GRAFT_CODE_EXIT_AFTER_FIRST_RENDER === '1') {
    // Warm compile must include the dynamically loaded chat UI. Compiling only
    // main.tsx leaves App/REPL/query to compile behind the "Opening UI" screen
    // on the first real launch, which can take minutes on Windows.
    await Promise.all([
      import('../components/App.js'),
      import('../screens/REPL.js'),
      import('../query.js'),
      import('../services/api/claude.js'),
      import('../services/graft/openaiCompat/proxy.js'),
    ])
    startupLoader?.stopGraftStartupLoader()
    return
  }
  // cliMain still initializes settings and commands before Ink can render.
  // Keep the phase truthful; main.tsx owns the actual UI handoff.
  startupLoader?.setGraftStartupPhase('modules')
  await cliMain()
  profileCheckpoint('cli_after_main_complete')
}

// eslint-disable-next-line custom-rules/no-top-level-side-effects
void main()

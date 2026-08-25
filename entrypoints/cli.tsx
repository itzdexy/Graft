import { feature } from 'bun:bundle'

// Bugfix for corepack auto-pinning, which adds yarnpkg to peoples' package.jsons
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.env.COREPACK_ENABLE_AUTO_PIN = '0'

// When the Windows ps1 launcher spawns Bun as a child process, Bun reports
// stdout.isTTY=false even on a real ConHost/WT console because the handle is
// inherited from a non-TTY pipe context. TOVYR_FORCE_INTERACTIVE=1 is set by
// the launcher explicitly to signal "this IS a real interactive terminal, trust us".
// We must patch isTTY before ANY module import so Ink's TTY guards all pass.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (process.env.TOVYR_FORCE_INTERACTIVE === '1') {
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
if (process.env.TOVYR_CODE_REMOTE === 'true') {
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
if (feature('ABLATION_BASELINE') && process.env.TOVYR_CODE_ABLATION_BASELINE) {
  for (const k of [
    'TOVYR_CODE_SIMPLE',
    'TOVYR_CODE_DISABLE_THINKING',
    'DISABLE_INTERLEAVED_THINKING',
    'DISABLE_COMPACT',
    'DISABLE_AUTO_COMPACT',
    'TOVYR_CODE_DISABLE_AUTO_MEMORY',
    'TOVYR_CODE_DISABLE_BACKGROUND_TASKS',
  ]) {
    // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
    process.env[k] ??= '1'
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
  const invokeCwd = process.env.TOVYR_INVOKE_CWD || process.env.TOVYR_INVOKE_CWD
  if (invokeCwd) {
    try {
      process.chdir(invokeCwd)
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : ''
      throw new Error(
        `Tovyr could not open the folder it was launched from (${invokeCwd})${detail}`,
      )
    }
  }

  let args = process.argv.slice(2)

  // Fast-path for cache-warm: strip the flag, exit after first render, and
  // continue through startup so Bun compiles the full module graph.
  const warmCacheIdx = args.indexOf('--warm-cache')
  if (warmCacheIdx !== -1) {
    args.splice(warmCacheIdx, 1)
    const realWarmCacheIdx = process.argv.indexOf('--warm-cache')
    if (realWarmCacheIdx !== -1) {
      process.argv.splice(realWarmCacheIdx, 1)
    }
    process.env.TOVYR_CODE_EXIT_AFTER_FIRST_RENDER = '1'
    args = process.argv.slice(2)
  }

  // Fast-path for --version/-v: zero module loading needed
  if (
    args.length === 1 &&
    (args[0] === '--version' || args[0] === '-v' || args[0] === '-V')
  ) {
    // MACRO.VERSION is inlined at build time
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`${MACRO.VERSION} (TOVYR)`)
    return
  }

  // Fast-path for --help/-h: avoid the heavy module graph; print a concise
  // usage summary and exit. Full option help is available via `tovyr --full-help`.
  if (
    args.length === 1 &&
    (args[0] === '--help' || args[0] === '-h')
  ) {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`TOVYR ${MACRO.VERSION}

The fast, polished AI coding agent for your terminal.

Usage:
  tovyr                         Start the interactive agent
  tovyr [prompt]                Start with a prompt
  tovyr provider list           List available providers
  tovyr auth login --provider <id> --key <key>
                                Connect your chosen provider
  tovyr --version               Print the version
  tovyr --help                  Show this help

Inside TOVYR:
  /provider                     Select a connected provider
  /model                        Select a model from that provider
  /plan                         Draft tovyrplan.md without editing code
  /code                         Implement the active plan
  /config                       Configure tools, reasoning, color, and motion
  /init                         Create tovyr.md for this project

Environment:
  TOVYR_FORCE_INTERACTIVE=1     Force the interactive UI
  TOVYR_AUTO_FAILOVER=1         Enable provider failover
  NO_COLOR=1                    Disable color

Docs: https://github.com/itsdexy/Tovyr`)
    return
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

  if (
    process.argv[2] === '--claude-in-chrome-mcp' ||
    process.argv[2] === '--chrome-native-host' ||
    process.argv[2] === '--computer-use-mcp'
  ) {
    const { isTovyrRuntime } = await import('../utils/tovyrRuntime.js')
    if (isTovyrRuntime()) {
      process.stderr.write(
        'This foreign browser/computer host entrypoint is unavailable in Tovyr. Use /browser or /computer.\n',
      )
      process.exitCode = 1
      return
    }
  }

  if (process.argv[2] === '--claude-in-chrome-mcp') {
    profileCheckpoint('cli_claude_in_chrome_mcp_path')
    const { runClaudeInChromeMcpServer } = await import(
      '../utils/claudeInChrome/mcpServer.js'
    )
    await runClaudeInChromeMcpServer()
    return
  } else if (process.argv[2] === '--chrome-native-host') {
    profileCheckpoint('cli_chrome_native_host_path')
    const { runChromeNativeHost } = await import(
      '../utils/claudeInChrome/chromeNativeHost.js'
    )
    await runChromeNativeHost()
    return
  } else if (
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
    const { runDaemonWorker } = await import('../daemon/workerRegistry.js')
    await runDaemonWorker(args[1])
    return
  }

  // Fast-path for `tovyr remote-control` (also accepts legacy `tovyr remote` / `tovyr sync` / `tovyr bridge`):
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
    const { getTovyrWebOAuthTokens } = await import('../utils/auth.js')
    if (!getTovyrWebOAuthTokens()?.accessToken) {
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

  // Fast-path for `tovyr daemon [subcommand]`: long-running supervisor.
  if (feature('DAEMON') && args[0] === 'daemon') {
    profileCheckpoint('cli_daemon_path')
    const { enableConfigs } = await import('../utils/config.js')
    enableConfigs()
    const { initSinks } = await import('../utils/sinks.js')
    initSinks()
    const { daemonMain } = await import('../daemon/main.js')
    await daemonMain(args.slice(1))
    return
  }

  // Fast-path for `tovyr ps|logs|attach|kill` and `--bg`/`--background`.
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
    const bg = await import('../cli/bg.js')
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
    const { templatesMain } = await import('../cli/handlers/templateJobs.js')
    await templatesMain(args)
    // process.exit (not return) — mountFleetView's Ink TUI can leave event
    // loop handles that prevent natural exit.
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0)
  }

  // Fast-path for `tovyr environment-runner`: headless BYOC runner.
  // feature() must stay inline for build-time dead code elimination.
  if (feature('BYOC_ENVIRONMENT_RUNNER') && args[0] === 'environment-runner') {
    profileCheckpoint('cli_environment_runner_path')
    const { environmentRunnerMain } = await import(
      '../environment-runner/main.js'
    )
    await environmentRunnerMain(args.slice(1))
    return
  }

  // Fast-path for `tovyr self-hosted-runner`: headless self-hosted-runner
  // targeting the SelfHostedRunnerWorkerService API (register + poll; poll IS
  // heartbeat). feature() must stay inline for build-time dead code elimination.
  if (feature('SELF_HOSTED_RUNNER') && args[0] === 'self-hosted-runner') {
    profileCheckpoint('cli_self_hosted_runner_path')
    const { selfHostedRunnerMain } = await import(
      '../self-hosted-runner/main.js'
    )
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
    process.env.TOVYR_CODE_SIMPLE = '1'
  }

  // No special flags detected, load and run the full CLI
  const startupLoader =
    process.env.TOVYR_WARM_QUIET_LOADER === '1'
      ? null
      : await import('../utils/tovyrStartupLoader.js')
  startupLoader?.startTovyrStartupLoader(
    process.env.TOVYR_CACHE_WARMED === '1' ? 'modules' : 'compile',
  )
  const { startCapturingEarlyInput } = await import('../utils/earlyInput.js')
  startCapturingEarlyInput()
  profileCheckpoint('cli_before_main_import')
  const { main: cliMain } = await import('../main.js')
  profileCheckpoint('cli_after_main_import')
  if (process.env.TOVYR_CODE_EXIT_AFTER_FIRST_RENDER === '1') {
    // Warm compile must include the dynamically loaded chat UI. Compiling only
    // main.tsx leaves App/REPL/query to compile behind the "Opening UI" screen
    // on the first real launch, which can take minutes on Windows.
    await Promise.all([
      import('../components/App.js'),
      import('../screens/REPL.js'),
      import('../query.js'),
      import('../services/api/claude.js'),
      import('../services/tovyr/openaiCompat/proxy.js'),
    ])
    startupLoader?.stopTovyrStartupLoader()
    return
  }
  startupLoader?.setTovyrStartupPhase('ui')
  await cliMain()
  profileCheckpoint('cli_after_main_complete')
}

// eslint-disable-next-line custom-rules/no-top-level-side-effects
void main()

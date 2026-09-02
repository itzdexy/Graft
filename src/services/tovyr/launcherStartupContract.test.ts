import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..', '..')

function source(path: string): string {
  const repositoryPath = join(root, path)
  return readFileSync(
    existsSync(repositoryPath) ? repositoryPath : join(root, 'src', path),
    'utf8',
  )
}

describe('Tovyr Windows startup contract', () => {
  test('accepts input before starting the loader or importing main', () => {
    const entry = source('entrypoints/cli.tsx')
    const inputStart = entry.indexOf('startCapturingEarlyInput()')
    const loaderStart = entry.indexOf('startTovyrStartupLoader(')
    const mainImport = entry.indexOf("await import('../main.js')")

    expect(inputStart).toBeGreaterThan(0)
    expect(loaderStart).toBeGreaterThan(inputStart)
    expect(loaderStart).toBeGreaterThan(0)
    expect(mainImport).toBeGreaterThan(loaderStart)
  })

  test('warm compile owns a visible loader and invalidates old stamps', () => {
    const warm = source('scripts/tovyr-warm.js')
    expect(warm).toContain("startTovyrStartupLoader('compile')")
    expect(warm).toContain("const WARM_CACHE_VERSION = '5'")
    expect(warm).toContain("'build-tovyr-runtime.ts'")
    expect(warm).toContain('walkMaxMtime')
    expect(warm).toContain('services/tovyr')
  })

  test('fast launchers prefer the generated source runtime', () => {
    const nodeLauncher = source('bin/tovyr.js')
    const powershellLauncher = source('bin/tovyr.ps1')
    const runtimeBuilder = source('scripts/build-tovyr-runtime.ts')

    expect(nodeLauncher).toContain('getTovyrRuntimeEntry() ?? cliEntry')
    expect(powershellLauncher).toContain(
      "'.cache\\runtime\\tovyr-cli.js'",
    )
    expect(runtimeBuilder).toContain("TOVYR_RUNTIME_BUNDLE_PACKAGES === '1'")
    expect(runtimeBuilder).toContain(": 'external'")
    expect(runtimeBuilder).toContain('packages: packageMode')
    expect(runtimeBuilder).toContain(
      "'process.env.NODE_ENV': '\"production\"'",
    )
    expect(powershellLauncher).toContain("'apps'")
    expect(powershellLauncher).toContain("'codex'")
    expect(powershellLauncher).toContain("'chatgpt'")
    expect(powershellLauncher).toContain("'claude'")
    expect(nodeLauncher).toContain("args[0] === 'launch' ? args.slice(1) : args")
    expect(nodeLauncher).toContain("args[0] === 'providers'")
    expect(nodeLauncher).toContain('CLI_SUBCOMMANDS.has(argv[0])')
    expect(nodeLauncher).toContain("'chatgpt'")
    expect(powershellLauncher).toContain("'serve'")
    expect(powershellLauncher).toContain("'mcp'")
  })

  test('warm compile handles optional source modules absent from the checkout', () => {
    const runtimeBuilder = source('scripts/build-tovyr-runtime.ts')
    expect(runtimeBuilder).toContain('missingLocalModule')
    expect(runtimeBuilder).toContain('tovyr-empty')
  })

  test('warm compile includes the dynamically loaded chat UI', () => {
    const entry = source('entrypoints/cli.tsx')
    const warmBranch = entry.indexOf(
      "process.env.TOVYR_CODE_EXIT_AFTER_FIRST_RENDER === '1'",
    )
    const appImport = entry.indexOf("import('../components/App.js')", warmBranch)
    const replImport = entry.indexOf("import('../screens/REPL.js')", warmBranch)
    const loaderStop = entry.indexOf(
      'startupLoader?.stopTovyrStartupLoader()',
      warmBranch,
    )

    expect(appImport).toBeGreaterThan(warmBranch)
    expect(replImport).toBeGreaterThan(warmBranch)
    expect(loaderStop).toBeGreaterThan(replImport)
  })

  test('hands off from stderr animation to the Ink boot screen', () => {
    const main = source('main.tsx')
    const bootScreen = source('components/tovyr/TovyrBootScreen.tsx')
    const stop = main.indexOf('stopTovyrStartupLoader({ keepCursorHidden: true })')
    const render = main.indexOf('root.render(<TovyrBootScreen phase="ui" />)')

    expect(stop).toBeGreaterThan(0)
    expect(render).toBeGreaterThan(stop)
    expect(bootScreen).toContain('useAppStateMaybeOutsideOfProvider')
    expect(bootScreen).not.toContain('useSettings()')
    // Flat and unboxed by design: a bordered card with a gradient wordmark,
    // progress bar, and backdrop competed with the only fact that matters
    // while waiting, which is whether the app is still moving.
    expect(bootScreen).not.toContain('borderStyle')
    expect(bootScreen).not.toContain('buildAmbientLine')
    expect(bootScreen).not.toContain('renderProgressBar')
    // Spinner resolves into a greeting rather than cutting off mid-spin.
    expect(bootScreen).toContain('RING_FRAMES')
    expect(bootScreen).toContain('Welcome to Tovyr')
    expect(main).toContain('prepareReplModules()')
  })

  test('does not block startup on provider model discovery', () => {
    const init = source('entrypoints/init.ts')

    expect(init).toContain(
      'applyActiveProviderSession({ awaitModelVerification: false })',
    )
    expect(init).not.toContain('prefetchActiveProviderModelIds()')
  })

  test('unwraps captured early input before rendering PromptInput', () => {
    const repl = source('screens/REPL.tsx')
    const promptInput = source('components/PromptInput/PromptInput.tsx')

    expect(repl).toContain('const [earlyInput] = useState(() => consumeEarlyInput())')
    expect(repl).toContain(
      'const [inputValue, setInputValueRaw] = useState(() => earlyInput.text)',
    )
    expect(repl).toContain('!earlyInput.shouldSubmit')
    expect(promptInput).toContain(
      "const input = typeof rawInput === 'string' ? rawInput : ''",
    )
  })

  test('keeps upstream Claude promotions out of Tovyr welcome UI', () => {
    const notice = source('components/LogoV2/Opus1mMergeNotice.tsx')
    const logo = source('components/LogoV2/LogoV2.tsx')
    const condensed = source('components/LogoV2/CondensedLogo.tsx')
    const dashboard = source(
      'components/tovyr/TovyrWorkspaceDashboard.tsx',
    )

    expect(notice).toContain('!isTovyrRuntime()')
    expect(logo).toContain('if (tovyr) return undefined')
    expect(logo).toContain(
      'const showGuestPassesUpsell = !tovyr && guestPassesEligible',
    )
    expect(logo.match(/\{!tovyr && <Opus1mMergeNotice \/>}/g)?.length).toBe(3)
    expect(condensed).not.toContain('Kairo' + ' Code')
    expect(condensed).not.toContain('Opus now defaults')
    expect(logo).toContain('<TovyrWorkspaceDashboard')
    // Tovyr branding and the session facts still lead the opening screen.
    expect(dashboard).toContain('Tovyr')
    expect(dashboard).toContain('QUICK_ACTIONS')
    expect(dashboard).toContain('CONNECTION_LABEL')
    // The opening screen is deliberately unboxed and uncentered: the previous
    // three bordered widgets fought for width and its sparse backdrop glyphs
    // read as rendering artifacts.
    expect(dashboard).not.toContain('borderStyle')
    expect(dashboard).not.toContain('buildAmbientScene')
    expect(dashboard).not.toContain('FeedColumn')
    expect(dashboard).not.toContain('Tips for getting started')
    expect(dashboard).not.toContain('Recent activity')
  })

  test('does not ship Chrome extension integration', () => {
    const main = source('main.tsx')
    const browserPrompt = source('services/tovyr/browser/prompts.ts')
    const verifierPrompt = source('commands/init-verifiers.ts')

    expect(existsSync(join(root, 'chrome-extension'))).toBe(false)
    expect(existsSync(join(root, 'src/commands/chrome'))).toBe(false)
    expect(existsSync(join(root, 'src/utils/claudeInChrome'))).toBe(false)
    expect(main).not.toContain("new Option('--chrome'")
    expect(main).not.toContain('setupClaudeInChrome')
    expect(browserPrompt).not.toContain('`/chrome`')
    expect(browserPrompt).toContain('Playwright or computer-use MCP')
    expect(verifierPrompt).not.toContain('Tovyr Chrome Extension')
    expect(verifierPrompt).toContain('Computer-use MCP')
  })

  test('owns Anthropic login without touching the installed Claude CLI', () => {
    const launcher = source('bin/tovyr.js')
    const providerFlow = source('commands/tovyr/provider.tsx')
    const prep = source('scripts/tovyr-prep-auth.js')
    const env = source('utils/env.ts')
    const envUtils = source('utils/envUtils.ts')
    const auth = source('utils/auth.ts')
    const codexTransport = source(
      'services/tovyr/codexCliProvider.ts',
    )
    const npmNotice = source('hooks/notifs/useNpmDeprecationNotification.tsx')

    expect(launcher).not.toContain("command: 'claude'")
    expect(providerFlow).toContain('<ConsoleOAuthFlow')
    expect(providerFlow).toContain("setProviderAuth(selectedId, 'oauth')")
    expect(prep).toContain("join(home, '.tovyr.json')")
    expect(prep).toContain("join(home, '.tovyr', '.credentials.json')")
    expect(prep).not.toContain("join(home, '.claude")
    expect(env).not.toContain('process.env.CLAUDE_CONFIG_DIR')
    expect(envUtils).not.toContain('process.env.CLAUDE_CONFIG_DIR')
    expect(auth).toContain('isTovyrAnthropicOAuthSession')
    expect(auth).toContain(
      "process.env.TOVYR_PROVIDER_AUTH_MODE === 'oauth'",
    )
    expect(providerFlow).toContain("setStep('codex-oauth')")
    expect(providerFlow).toContain('<CodexAccountLogin')
    expect(codexTransport).toContain("['login', 'status']")
    expect(codexTransport).toContain("'--sandbox'")
    expect(codexTransport).toContain("'read-only'")
    expect(codexTransport).not.toContain("from 'node:fs'")
    expect(npmNotice).toContain('if (isTovyrRuntime()) return null')
  })

  test('does not leak Tovyr provider environment or Anthropic marketplace UI', () => {
    const launcher = source('bin/tovyr.ps1')
    const nodeLauncher = source('bin/tovyr.js')
    const installer = source('bin/install-tovyr.ps1')
    const postinstall = source('scripts/tovyr-postinstall.js')
    const npmManifest = source('package.npm.json')
    const marketplaceHook = source(
      'hooks/useOfficialMarketplaceNotification.tsx',
    )
    const marketplaceStartup = source(
      'utils/plugins/officialMarketplaceStartupCheck.ts',
    )

    expect(launcher).toContain('function Restore-TovyrEnvironment')
    expect(launcher).toContain("'ANTHROPIC_API_KEY'")
    expect(launcher).toContain("'ANTHROPIC_AUTH_TOKEN'")
    expect(launcher).toContain('Restore-TovyrEnvironment')
    expect(installer).toContain(
      "SetEnvironmentVariable('TOVYR_PACKAGE_ROOT', $null, 'User')",
    )
    expect(installer).not.toContain(
      "SetEnvironmentVariable('TOVYR_PACKAGE_ROOT', $repoRoot, 'User')",
    )
    expect(installer.toLowerCase()).not.toContain('claude')
    expect(nodeLauncher).not.toContain('tovyr-run-claude')
    expect(nodeLauncher).not.toContain('tovyr-patch-binary')
    expect(postinstall).not.toContain('patchClaudeBinaryBranding')
    expect(postinstall).not.toContain('tovyr-patch-binary')
    expect(npmManifest).not.toContain('@anthropic-ai/claude-code')
    expect(npmManifest).not.toContain('tovyr-run-claude')
    expect(marketplaceHook).toContain('if (isTovyrRuntime()) return []')
    expect(marketplaceStartup).toContain('if (isTovyrRuntime())')
  })

  test('streams prose in chat while the dock shows one honest stream state', () => {
    const repl = source('screens/REPL.tsx')
    const dock = source('components/tovyr/TovyrChatDock.tsx')
    const messages = source('components/Messages.tsx')
    const prompt = source('components/PromptInput/PromptInput.tsx')
    const footer = source('components/PromptInput/PromptInputFooter.tsx')

    expect(repl).toContain(
      'isTovyrRuntime() || !hasCursorUpViewportYankBug()',
    )
    expect(repl).toContain('? isTovyrRuntime()')
    expect(messages).toContain('<StreamingMarkdown>{displayStreamingText}</StreamingMarkdown>')
    expect(dock).toContain('streamingTextPreview={streamingTextPreview}')
    expect(dock).toContain('suppressIdleStatus={suppressIdleStatus}')
    expect(dock).not.toContain('streamingTextPreview={null}')
    expect(prompt).toContain('briefOwnsGap || isTovyrRuntime()')
    expect(footer).toContain('<TovyrModeBadge')
  })

  test('scopes planner permission metadata into the live tool context', () => {
    const repl = source('screens/REPL.tsx')
    expect(repl).toContain('resolveTovyrTurnPermissionMode(')
    expect(repl).toContain('const getTurnAppState = () =>')
    expect(repl).toContain('const state = getTurnAppState()')
    expect(repl).toContain('getAppState: getTurnAppState')
  })

  test('treats Ctrl+C exit 130 as cancellation, not setup failure', () => {
    const launcher = source('bin/tovyr.ps1')
    expect(launcher).toContain(
      '$exitCode -ne 0 -and $exitCode -ne 130',
    )
  })

  test('keeps app-launch failures separate from Tovyr setup failures', () => {
    const launcher = source('bin/tovyr.ps1')
    expect(launcher).toContain('$TovyrAppCommands')
    expect(launcher).toContain("Tovyr app command '$($cliArgs[0])' exited with code $exitCode.")
    expect(launcher).toContain('Run: tovyr setup')
  })
})

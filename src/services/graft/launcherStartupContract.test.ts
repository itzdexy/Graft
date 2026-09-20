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

describe('Graft Windows startup contract', () => {
  test('accepts input before starting the loader or importing main', () => {
    const entry = source('entrypoints/cli.tsx')
    const inputStart = entry.indexOf('startCapturingEarlyInput()')
    const loaderStart = entry.indexOf('startGraftStartupLoader(')
    const mainImport = entry.indexOf("await import('../main.js')")

    expect(inputStart).toBeGreaterThan(0)
    expect(loaderStart).toBeGreaterThan(inputStart)
    expect(loaderStart).toBeGreaterThan(0)
    expect(mainImport).toBeGreaterThan(loaderStart)
  })

  test('warm compile owns a visible loader and invalidates old stamps', () => {
    const warm = source('scripts/graft-warm.js')
    expect(warm).toContain("startGraftStartupLoader('compile')")
    expect(warm).toContain("const WARM_CACHE_VERSION = '5'")
    expect(warm).toContain("'build-graft-runtime.ts'")
    expect(warm).toContain('walkMaxMtime')
    expect(warm).toContain('services/graft')
  })

  test('fast launchers prefer the generated source runtime', () => {
    const nodeLauncher = source('bin/graft.js')
    const powershellLauncher = source('bin/graft.ps1')
    const runtimeBuilder = source('scripts/build-graft-runtime.ts')

    expect(nodeLauncher).toContain('getGraftRuntimeEntry() ?? cliEntry')
    expect(powershellLauncher).toContain(
      "'.cache\\runtime\\graft-cli.js'",
    )
    expect(runtimeBuilder).toContain("GRAFT_RUNTIME_BUNDLE_PACKAGES === '1'")
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
    const runtimeBuilder = source('scripts/build-graft-runtime.ts')
    expect(runtimeBuilder).toContain('missingLocalModule')
    expect(runtimeBuilder).toContain('graft-empty')
  })

  test('warm compile includes the dynamically loaded chat UI', () => {
    const entry = source('entrypoints/cli.tsx')
    const warmBranch = entry.indexOf(
      "process.env.GRAFT_CODE_EXIT_AFTER_FIRST_RENDER === '1'",
    )
    const appImport = entry.indexOf("import('../components/App.js')", warmBranch)
    const replImport = entry.indexOf("import('../screens/REPL.js')", warmBranch)
    const loaderStop = entry.indexOf(
      'startupLoader?.stopGraftStartupLoader()',
      warmBranch,
    )

    expect(appImport).toBeGreaterThan(warmBranch)
    expect(replImport).toBeGreaterThan(warmBranch)
    expect(loaderStop).toBeGreaterThan(replImport)
  })

  test('hands off from stderr animation to the Ink boot screen', () => {
    const main = source('main.tsx')
    const bootScreen = source('components/graft/GraftBootScreen.tsx')
    const stop = main.indexOf('stopGraftStartupLoader({ keepCursorHidden: true })')
    const render = main.indexOf('root.render(<GraftBootScreen phase="ui" />)')

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
    expect(bootScreen).toContain('Welcome to Graft')
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

  test('keeps upstream Claude promotions out of Graft welcome UI', () => {
    const notice = source('components/LogoV2/Opus1mMergeNotice.tsx')
    const logo = source('components/LogoV2/LogoV2.tsx')
    const condensed = source('components/LogoV2/CondensedLogo.tsx')
    const dashboard = source(
      'components/graft/GraftWorkspaceDashboard.tsx',
    )

    expect(notice).toContain('!isGraftRuntime()')
    expect(logo).toContain('if (graft) return undefined')
    expect(logo).toContain(
      'const showGuestPassesUpsell = !graft && guestPassesEligible',
    )
    expect(logo.match(/\{!graft && <Opus1mMergeNotice \/>}/g)?.length).toBe(3)
    expect(condensed).not.toContain('Kairo' + ' Code')
    expect(condensed).not.toContain('Opus now defaults')
    expect(logo).toContain('if (graft) return null')
    // Graft branding and the session facts still lead the opening screen.
    expect(dashboard).toContain('Graft')
    expect(dashboard).not.toContain('QUICK_ACTIONS')
    expect(dashboard).toContain('sessionDate')
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
    const browserPrompt = source('services/graft/browser/prompts.ts')
    const verifierPrompt = source('commands/init-verifiers.ts')

    expect(existsSync(join(root, 'chrome-extension'))).toBe(false)
    expect(existsSync(join(root, 'src/commands/chrome'))).toBe(false)
    expect(existsSync(join(root, 'src/utils/claudeInChrome'))).toBe(false)
    expect(main).not.toContain("new Option('--chrome'")
    expect(main).not.toContain('setupClaudeInChrome')
    expect(browserPrompt).not.toContain('`/chrome`')
    expect(browserPrompt).toContain('WebsiteTest runs local browser checks')
    expect(verifierPrompt).not.toContain('Graft Chrome Extension')
    expect(verifierPrompt).toContain('Computer-use MCP')
  })

  test('owns Anthropic login without touching the installed Claude CLI', () => {
    const launcher = source('bin/graft.js')
    const providerFlow = source('commands/graft/provider.tsx')
    const prep = source('scripts/graft-prep-auth.js')
    const env = source('utils/env.ts')
    const envUtils = source('utils/envUtils.ts')
    const auth = source('utils/auth.ts')
    const codexTransport = source(
      'services/graft/codexCliProvider.ts',
    )
    const npmNotice = source('hooks/notifs/useNpmDeprecationNotification.tsx')

    expect(launcher).not.toContain("command: 'claude'")
    expect(providerFlow).toContain('<ConsoleOAuthFlow')
    expect(providerFlow).toContain("setProviderAuth(selectedId, 'oauth')")
    expect(prep).toContain("join(home, '.graft.json')")
    expect(prep).toContain("join(home, '.graft', '.credentials.json')")
    expect(prep).not.toContain("join(home, '.claude")
    expect(env).not.toContain('process.env.CLAUDE_CONFIG_DIR')
    expect(envUtils).not.toContain('process.env.CLAUDE_CONFIG_DIR')
    expect(auth).toContain('isGraftAnthropicOAuthSession')
    expect(auth).toContain(
      "process.env.GRAFT_PROVIDER_AUTH_MODE === 'oauth'",
    )
    expect(providerFlow).toContain("setStep('codex-oauth')")
    expect(providerFlow).toContain('<CodexAccountLogin')
    expect(codexTransport).toContain("['login', 'status']")
    expect(codexTransport).toContain("'--sandbox'")
    expect(codexTransport).toContain("'read-only'")
    expect(codexTransport).not.toContain("from 'node:fs'")
    expect(npmNotice).toContain('if (isGraftRuntime()) return null')
  })

  test('does not leak Graft provider environment or Anthropic marketplace UI', () => {
    const launcher = source('bin/graft.ps1')
    const nodeLauncher = source('bin/graft.js')
    const installer = source('bin/install-graft.ps1')
    const postinstall = source('scripts/graft-postinstall.js')
    const npmManifest = source('package.npm.json')
    const marketplaceHook = source(
      'hooks/useOfficialMarketplaceNotification.tsx',
    )
    const marketplaceStartup = source(
      'utils/plugins/officialMarketplaceStartupCheck.ts',
    )

    expect(launcher).toContain('function Restore-GraftEnvironment')
    expect(launcher).toContain("'ANTHROPIC_API_KEY'")
    expect(launcher).toContain("'ANTHROPIC_AUTH_TOKEN'")
    expect(launcher).toContain('Restore-GraftEnvironment')
    expect(installer).toContain(
      "SetEnvironmentVariable('GRAFT_PACKAGE_ROOT', $null, 'User')",
    )
    expect(installer).not.toContain(
      "SetEnvironmentVariable('GRAFT_PACKAGE_ROOT', $repoRoot, 'User')",
    )
    expect(installer.toLowerCase()).not.toContain('claude')
    expect(nodeLauncher).not.toContain('graft-run-claude')
    expect(nodeLauncher).not.toContain('graft-patch-binary')
    expect(postinstall).not.toContain('patchClaudeBinaryBranding')
    expect(postinstall).not.toContain('graft-patch-binary')
    expect(npmManifest).not.toContain('@anthropic-ai/claude-code')
    expect(npmManifest).not.toContain('graft-run-claude')
    expect(marketplaceHook).toContain('if (isGraftRuntime()) return []')
    expect(marketplaceStartup).toContain('if (isGraftRuntime())')
  })

  test('streams prose in chat while the dock shows one honest stream state', () => {
    const repl = source('screens/REPL.tsx')
    const dock = source('components/graft/GraftChatDock.tsx')
    const messages = source('components/Messages.tsx')
    const prompt = source('components/PromptInput/PromptInput.tsx')
    const footer = source('components/PromptInput/PromptInputFooter.tsx')

    expect(repl).toContain(
      'isGraftRuntime() || !hasCursorUpViewportYankBug()',
    )
    expect(repl).toContain('? isGraftRuntime()')
    expect(messages).toContain('<StreamingMarkdown>{displayStreamingText}</StreamingMarkdown>')
    expect(dock).toContain('streamingTextPreview={streamingTextPreview}')
    expect(dock).toContain('suppressIdleStatus={suppressIdleStatus}')
    expect(dock).not.toContain('streamingTextPreview={null}')
    expect(prompt).toContain('briefOwnsGap || isGraftRuntime()')
    expect(footer).toContain('<GraftModeBadge')
  })

  test('scopes planner permission metadata into the live tool context', () => {
    const repl = source('screens/REPL.tsx')
    expect(repl).toContain('resolveGraftTurnPermissionMode(')
    expect(repl).toContain('const getTurnAppState = () =>')
    expect(repl).toContain('const state = getTurnAppState()')
    expect(repl).toContain('getAppState: getTurnAppState')
  })

  test('treats Ctrl+C exit 130 as cancellation, not setup failure', () => {
    const launcher = source('bin/graft.ps1')
    expect(launcher).toContain(
      '$exitCode -ne 0 -and $exitCode -ne 130',
    )
  })

  test('keeps app-launch failures separate from Graft setup failures', () => {
    const launcher = source('bin/graft.ps1')
    expect(launcher).toContain('$GraftAppCommands')
    expect(launcher).toContain("Graft app command '$($cliArgs[0])' exited with code $exitCode.")
    expect(launcher).toContain('Run: graft setup')
  })
})

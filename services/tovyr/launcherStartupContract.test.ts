import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('Tovyr Windows startup contract', () => {
  test('starts the loader before importing the heavy main module', () => {
    const entry = source('entrypoints/cli.tsx')
    const loaderStart = entry.indexOf('startTovyrStartupLoader(')
    const mainImport = entry.indexOf("await import('../main.js')")

    expect(loaderStart).toBeGreaterThan(0)
    expect(mainImport).toBeGreaterThan(loaderStart)
  })

  test('warm compile owns a visible loader and invalidates old stamps', () => {
    const warm = source('scripts/tovyr-warm.js')
    expect(warm).toContain("startTovyrStartupLoader('compile')")
    expect(warm).toContain("const WARM_CACHE_VERSION = '3'")
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
    expect(main).toContain('prepareReplModules()')
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
    expect(dashboard).toContain('Welcome to TOVYR')
    expect(dashboard).toContain('Quick Commands')
    expect(dashboard).toContain('Active Connection')
    expect(dashboard).toContain('<TovyrBuddy')
    expect(dashboard).toContain('borderStyle="round"')
    expect(dashboard).not.toContain('FeedColumn')
    expect(dashboard).not.toContain('Tips for getting started')
    expect(dashboard).not.toContain('Recent activity')
  })

  test('keeps unavailable Chrome extension integration out of Tovyr', () => {
    const main = source('main.tsx')
    const chromeCommand = source('commands/chrome/index.ts')
    const chromeSetup = source('utils/claudeInChrome/setup.ts')
    const browserPrompt = source('services/tovyr/browser/prompts.ts')
    const verifierPrompt = source('commands/init-verifiers.ts')

    expect(main).toContain('const tovyrChromeUnavailable = isTovyrRuntime()')
    expect(main).toContain('!tovyrChromeUnavailable &&')
    expect(chromeCommand).toContain('!isTovyrRuntime()')
    expect(chromeSetup).toContain('if (isTovyrRuntime()) return false')
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
    const chrome = source('scripts/tovyr-chrome-cli.js')
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
    expect(chrome).not.toContain('com.anthropic')
    expect(marketplaceHook).toContain('if (isTovyrRuntime()) return []')
    expect(marketplaceStartup).toContain('if (isTovyrRuntime())')
  })

  test('streams assistant text in chat instead of the bottom activity dock', () => {
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

  test('treats Ctrl+C exit 130 as cancellation, not setup failure', () => {
    const launcher = source('bin/tovyr.ps1')
    expect(launcher).toContain(
      '$exitCode -ne 0 -and $exitCode -ne 130',
    )
  })
})

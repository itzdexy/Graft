/**
 * npm global install fallback — run bundled @blink-ai/blink (patched).
 * Used when entrypoints/cli.tsx is not present (launcher-only package).
 */
import { spawn } from 'node:child_process'
import { BLINK_PRODUCT_NAME, BLINK_VERSION } from '../constants/blink.js'
import {
  getBlinkPackageRoot,
  resolveClaudeLauncher,
} from './blink-package-root.js'
import { buildBlinkChildAuthEnv, prepareBlinkAuth } from './blink-prep-auth.js'
import { patchClaudeBinaryBranding } from './blink-patch-binary.js'
import { applyBlinkSettingsTune } from './blink-tune-settings.js'
import {
  applyLauncherDefaultArgs,
  isLauncherOnlyInstall,
} from './blink-launch-hints.js'

const root = getBlinkPackageRoot()

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) resolve({ signal })
      else resolve({ code: code ?? 0 })
    })
  })
}

function buildCliArgs(argv) {
  const launcherOnly = isLauncherOnlyInstall(root)
  let args = applyLauncherDefaultArgs(argv, launcherOnly)
  if (args.includes('--fast')) {
    args = args.filter(a => a !== '--fast')
    if (!args.includes('--bare')) args = ['--bare', ...args]
  }
  return args
}

export async function runClaudeCodeFallback(argv) {
  process.env.BLINK_INVOKE_CWD = process.cwd()
  const cliArgs = buildCliArgs(argv)
  prepareBlinkAuth()
  applyBlinkSettingsTune()
  patchClaudeBinaryBranding()

  const launcher = resolveClaudeLauncher(root)
  if (!launcher) {
    console.error(
      'Blink: bundled runtime is not installed.\n' +
        '  npm install -g blinkcode\n\n' +
        'For the full Blink UI (multi-provider, agents, buddy), clone the repo and run from source.',
    )
    process.exit(1)
  }

  const childEnv = {
    ...process.env,
    ...buildBlinkChildAuthEnv(),
    BLINK_PACKAGE_ROOT: root,
    BLINK_LAUNCHER_ONLY: '1',
  }
  if (cliArgs.includes('--bare')) {
    childEnv.CLAUDE_CODE_SIMPLE = '1'
  }
  delete childEnv.CLAUDE_CODE_OAUTH_TOKEN

  process.title = BLINK_PRODUCT_NAME
  const child = spawn(launcher, cliArgs, {
    cwd: process.env.BLINK_INVOKE_CWD || process.cwd(),
    stdio: 'inherit',
    env: childEnv,
    shell: process.platform === 'win32' && launcher.endsWith('.cmd'),
  })

  const result = await waitForChild(child)
  if ('signal' in result && result.signal) process.kill(process.pid, result.signal)
  else process.exit(result.code ?? 0)
}

if (process.argv[1]?.endsWith('blink-run-claude.js')) {
  const args = process.argv.slice(2)
  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
    console.log(`${BLINK_VERSION} (${BLINK_PRODUCT_NAME})`)
    process.exit(0)
  }
  await runClaudeCodeFallback(args)
}

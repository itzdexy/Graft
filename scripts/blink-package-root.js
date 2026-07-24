import { execSync } from 'node:child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { getBlinkHome } from './blink-home.js'

export { getBlinkHome, platformLabel } from './blink-home.js'

/** Directory containing package.json (blinkcode npm root). */
export function getBlinkPackageRoot() {
  if (process.env.BLINK_PACKAGE_ROOT && existsSync(process.env.BLINK_PACKAGE_ROOT)) {
    return process.env.BLINK_PACKAGE_ROOT
  }
  if (process.env.BLINK_SRC && existsSync(process.env.BLINK_SRC)) {
    return process.env.BLINK_SRC
  }
  // scripts/ → package root
  return dirname(dirname(fileURLToPath(import.meta.url)))
}

/** Blink source CLI entry (Ink UI, BlinkBuddy, etc.) — never blink.exe. */
export function resolveBlinkCliEntry(packageRoot = getBlinkPackageRoot()) {
  const entry = join(packageRoot, 'entrypoints', 'cli.tsx')
  return existsSync(entry) ? entry : null
}

export function resolveBunExecutable() {
  if (process.env.BLINK_BUN_CMD) return process.env.BLINK_BUN_CMD

  const home = getBlinkHome()
  const bunName = process.platform === 'win32' ? 'bun.exe' : 'bun'
  const wellKnown = [
    home && join(home, '.bun', 'bin', bunName),
    process.platform === 'win32' && process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, 'bun', 'bin', 'bun.exe')
      : null,
    process.platform === 'darwin' ? '/opt/homebrew/bin/bun' : null,
    process.platform === 'darwin' ? '/usr/local/bin/bun' : null,
    process.platform === 'linux' ? '/usr/local/bin/bun' : null,
    process.platform === 'linux' ? '/snap/bin/bun' : null,
  ].filter(Boolean)

  for (const p of wellKnown) {
    if (existsSync(p)) return p
  }

  const lookup = process.platform === 'win32' ? 'where bun' : 'which bun'
  try {
    const out = execSync(lookup, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim()
      .split(/\r?\n/)[0]
      ?.trim()
    if (out && existsSync(out)) return out
  } catch {
    // not on PATH
  }

  return 'bun'
}

export function printBunInstallHelp() {
  const lines =
    process.platform === 'win32'
      ? [
          'Bun is required to run Blink.',
          '',
          'Install: https://bun.sh',
          '  powershell -c "irm bun.sh/install.ps1 | iex"',
          '',
          'Then restart your terminal and run: blink',
        ]
      : [
          'Bun is required to run Blink.',
          '',
          'Install: https://bun.sh',
          '  curl -fsSL https://bun.sh/install | bash',
          '',
          'Then add ~/.bun/bin to PATH and run: blink',
        ]
  console.error(lines.join('\n'))
}

/** Resolve Bun and exit with install help if missing. */
export function assertBunAvailable(bunCmd = resolveBunExecutable()) {
  if (bunCmd !== 'bun' && existsSync(bunCmd)) {
    return bunCmd
  }

  const lookup = process.platform === 'win32' ? 'where bun' : 'which bun'
  try {
    execSync(lookup, { stdio: 'ignore' })
    return bunCmd
  } catch {
    printBunInstallHelp()
    process.exit(1)
  }
}

/** @deprecated Blink runs the Bun/source CLI only and never launches Claude binaries. */
export function resolveClaudeLauncher(packageRoot = getBlinkPackageRoot()) {
  return null
}

/** @deprecated Blink runs the Bun/source CLI only and never patches native Claude binaries. */
export function resolveClaudeNativeExe(packageRoot = getBlinkPackageRoot()) {
  return null
}

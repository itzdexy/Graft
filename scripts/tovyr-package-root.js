import { execFileSync, execSync } from 'node:child_process'
import { existsSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { getTovyrHome } from './tovyr-home.js'

export { getTovyrHome, platformLabel } from './tovyr-home.js'

/** Directory containing package.json (tovyrcode npm root). */
export function getTovyrPackageRoot() {
  if (
    process.env.TOVYR_PACKAGE_ROOT &&
    isTovyrPackageRoot(process.env.TOVYR_PACKAGE_ROOT)
  ) {
    return process.env.TOVYR_PACKAGE_ROOT
  }
  if (process.env.TOVYR_SRC && isTovyrPackageRoot(process.env.TOVYR_SRC)) {
    return process.env.TOVYR_SRC
  }
  // scripts/ → package root
  return dirname(dirname(fileURLToPath(import.meta.url)))
}

function isTovyrPackageRoot(root) {
  const isFile = (...parts) => {
    try {
      return statSync(join(root, ...parts)).isFile()
    } catch {
      return false
    }
  }
  return (
    isFile('entrypoints', 'cli.tsx') ||
    (isFile('package.json') &&
      (isFile('bin', 'tovyr.js') || isFile('bin', 'tovyr.js')) &&
      (isFile('constants', 'tovyr.js') || isFile('constants', 'product.ts') || isFile('constants', 'tovyr.js')))
  )
}

/** Tovyr source CLI entry (Ink UI, TovyrBuddy, etc.) — never tovyr.exe. */
export function resolveTovyrCliEntry(packageRoot = getTovyrPackageRoot()) {
  const sourceEntry = join(packageRoot, 'entrypoints', 'cli.tsx')
  if (existsSync(sourceEntry)) return sourceEntry
  const bundledEntry = join(packageRoot, 'runtime', 'cli.js')
  return existsSync(bundledEntry) ? bundledEntry : null
}

export function resolveBunExecutable() {
  const home = getTovyrHome()
  const bunName = process.platform === 'win32' ? 'bun.exe' : 'bun'
  const override = process.env.TOVYR_BUN_CMD?.trim()
  if (override && isUsableBun(override)) {
    return override
  }

  const wellKnown = [
    process.env.BUN_INSTALL
      ? join(process.env.BUN_INSTALL, 'bin', bunName)
      : null,
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
    if (isUsableBun(p)) return p
  }

  const lookup = process.platform === 'win32' ? 'where bun' : 'which bun'
  try {
    const out = execSync(lookup, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim()
      .split(/\r?\n/)[0]
      ?.trim()
    if (out && isUsableBun(out)) return out
  } catch {
    // not on PATH
  }

  return 'bun'
}

function isUsableBun(candidate) {
  try {
    if (candidate !== 'bun' && !statSync(candidate).isFile()) return false
    execFileSync(candidate, ['--version'], {
      stdio: 'ignore',
      timeout: 3_000,
      windowsHide: true,
    })
    return true
  } catch {
    return false
  }
}

export function printBunInstallHelp() {
  const lines =
    process.platform === 'win32'
      ? [
          'Bun is required to run Tovyr.',
          '',
          'Install: https://bun.sh',
          '  powershell -c "irm bun.sh/install.ps1 | iex"',
          '',
          'Then restart your terminal and run: tovyr',
        ]
      : [
          'Bun is required to run Tovyr.',
          '',
          'Install: https://bun.sh',
          '  curl -fsSL https://bun.sh/install | bash',
          '',
          'Then add ~/.bun/bin to PATH and run: tovyr',
        ]
  console.error(lines.join('\n'))
}

/** Resolve Bun and exit with install help if missing. */
export function assertBunAvailable(bunCmd = resolveBunExecutable()) {
  if (isUsableBun(bunCmd)) {
    return bunCmd
  }
  printBunInstallHelp()
  process.exit(1)
}


/**
 * Launch-time hints for npm launcher vs full source checkout.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { getBlinkPackageRoot, resolveBlinkCliEntry } from './blink-package-root.js'

const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Gemfile',
  'composer.json',
  'blink.md',
  'CLAUDE.md',
  'AGENTS.md',
]

export function isLauncherOnlyInstall(packageRoot = getBlinkPackageRoot()) {
  return !resolveBlinkCliEntry(packageRoot)
}

function getHomeDirectory() {
  return process.env.USERPROFILE || process.env.HOME || homedir() || undefined
}

function isHomeDirectory(dir) {
  const home = getHomeDirectory()
  if (!home || !dir) return false
  try {
    return resolve(dir).toLowerCase() === resolve(home).toLowerCase()
  } catch {
    return false
  }
}

function shouldBlockHomeDirectory(dir) {
  if (process.env.BLINK_ALLOW_HOME === '1') return false
  if (!isHomeDirectory(dir)) return false
  if (isLikelyProjectDirectory(dir)) return false
  return true
}

export function isLikelyProjectDirectory(dir) {
  if (!dir) return false
  try {
    const root = resolve(dir)
    return PROJECT_MARKERS.some(marker => existsSync(join(root, marker)))
  } catch {
    return false
  }
}

/** True when cwd is the user's home directory. */
export function isUserHomeDirectory(cwd = process.cwd()) {
  const home = getHomeDirectory()
  if (!home || !cwd) return false
  try {
    return resolve(cwd).toLowerCase() === resolve(home).toLowerCase()
  } catch {
    return false
  }
}

export function isHomeDirectoryCwd(cwd = process.cwd()) {
  return shouldBlockHomeDirectory(cwd)
}

function formatHomeBlockMessage(cwd) {
  const home = getHomeDirectory() ?? '(unknown)'
  let resolvedCwd = cwd
  try {
    resolvedCwd = resolve(cwd)
  } catch {
    // keep raw cwd
  }
  const projectHint = isLikelyProjectDirectory(cwd)
    ? ''
    : '\n  If this folder is your project, add package.json or run: blink --allow-home\n'
  return [
    '',
    'Cannot start from your home directory.',
    '',
    `  Current: ${resolvedCwd}`,
    `  Home:    ${home}`,
    '',
    '  cd into a project folder, then run blink again:',
    '    cd path/to/your-project',
    '    blink',
    projectHint,
    '  Override (not recommended): blink --allow-home',
    '',
  ].join('\n')
}

export function shouldSkipHomeDirectoryCheck(argv) {
  if (argv.includes('--allow-home') || process.env.BLINK_ALLOW_HOME === '1') {
    return true
  }
  if (argv.includes('--help') || argv.includes('-h')) return true
  if (
    argv.length === 1 &&
    (argv[0] === '--version' || argv[0] === '-v' || argv[0] === '-V')
  ) {
    return true
  }
  const sub = argv[0]
  if (
    sub === 'setup' ||
    sub === 'doctor' ||
    sub === 'config' ||
    sub === 'models' ||
    sub === 'ask' ||
    sub === 'sessions'
  ) {
    return true
  }
  if (sub === 'auth' || sub === 'provider') return true
  if (argv.includes('-p') || argv.includes('--print')) return true
  return false
}

/** Remove --allow-home from argv after handling. */
export function stripAllowHomeFlag(argv) {
  if (argv.includes('--allow-home')) {
    process.env.BLINK_ALLOW_HOME = '1'
  }
  return argv.filter(a => a !== '--allow-home')
}

/**
 * Exit before Bun/CLI if workspace is the user home directory (non-interactive fallback).
 */
export function assertNotHomeDirectory(argv) {
  const allowHome =
    argv.includes('--allow-home') || process.env.BLINK_ALLOW_HOME === '1'
  const cleaned = stripAllowHomeFlag(argv)
  if (allowHome) return cleaned

  const cwd = process.cwd()
  if (shouldBlockHomeDirectory(cwd)) {
    console.error(formatHomeBlockMessage(cwd))
    process.exit(1)
  }
  return cleaned
}

export function warnIfHomeDirectory() {
  const cwd = process.cwd()
  if (!shouldBlockHomeDirectory(cwd)) return
  console.error(formatHomeBlockMessage(cwd))
  process.exit(1)
}

/** npm launcher defaults to --bare unless user passed --full */
export function applyLauncherDefaultArgs(argv, launcherOnly) {
  let args = [...argv]
  if (!launcherOnly) return args
  if (args.includes('--full')) {
    return args.filter(a => a !== '--full')
  }
  if (args.includes('--fast')) {
    args = args.filter(a => a !== '--fast')
    if (!args.includes('--bare')) args = ['--bare', ...args]
    return args
  }
  if (!args.includes('--bare')) {
    args = ['--bare', ...args]
  }
  return args
}

/**
 * On Windows, open Tovyr in a fresh console so Ink alt-screen starts clean
 * (no polluted scrollback from the parent shell).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { getTovyrPackageRoot } from './tovyr-package-root.js'

/** Enter alt-screen and clear before Ink mounts (avoids PSReadLine prompt leaking into setup UI). */
export function prepareWindowsTuiConsole() {
  if (process.platform !== 'win32') return
  if (!process.stdout.isTTY && !process.stderr.isTTY) return
  const out = process.stdout.isTTY ? process.stdout : process.stderr
  out.write('\x1b[?1049h\x1b[2J\x1b[H')
}

const NON_WINDOW_COMMANDS = new Set(['setup', 'doctor', 'auth', 'provider'])

export function stripInWindowFlag(argv) {
  return argv.filter(a => a !== '--in-window')
}

/** @param {string[]} argv */
export function shouldOpenNewWindow(argv) {
  if (process.platform !== 'win32') return false
  // Opt-in only: a separate window flashes/closes on any startup hiccup, so the
  // reliable default is a clean in-place launch (alt-screen renderer).
  if (process.env.TOVYR_NEW_WINDOW !== '1') return false
  if (process.env.TOVYR_IN_WINDOW === '1') return false
  if (process.env.TOVYR_NO_NEW_WINDOW === '1') return false
  if (argv.includes('--in-window')) return false

  const args = stripInWindowFlag(argv)
  if (args.some(a => a === '--help' || a === '-h' || a === '--version' || a === '-v' || a === '-V')) {
    return false
  }
  if (args.length >= 1 && NON_WINDOW_COMMANDS.has(args[0])) {
    return false
  }

  // Skip when stdin/stdout are piped (scripts, CI).
  if (!process.stdin.isTTY && !process.stdout.isTTY) return false

  return true
}

function findWindowsTerminal() {
  const local = process.env.LOCALAPPDATA
  if (local) {
    const candidate = path.join(
      local,
      'Microsoft',
      'WindowsApps',
      'wt.exe',
    )
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * Spawn tovyr.ps1 in a new console tab/window. Returns true if a child was started.
 * @param {string[]} argv
 */
export function spawnTovyrInNewWindow(argv) {
  const pkgRoot = getTovyrPackageRoot()
  const ps1 = path.join(pkgRoot, 'bin', 'tovyr.ps1')
  if (!existsSync(ps1)) return false

  const args = stripInWindowFlag(argv)
  const cwd = process.cwd()
  const env = {
    ...process.env,
    TOVYR_INVOKE_CWD: cwd,
    TOVYR_INVOKE_CWD_LOCKED: '1',
  }
  const psArgs = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    ps1,
    '--in-window',
    ...args,
  ]

  const wt = findWindowsTerminal()
  const launch = (command, launchArgs, options = {}) => {
    const child = spawn(command, launchArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: options.cwd,
      env,
    })
    child.unref()
  }

  if (wt) {
    launch(wt, [
      'new-tab',
      '-d',
      cwd,
      '--title',
      'Tovyr',
      'powershell.exe',
      ...psArgs,
    ])
  } else {
    launch('powershell.exe', psArgs, { cwd })
  }

  return true
}

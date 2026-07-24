import { openSync } from 'fs'
import { ReadStream } from 'tty'
import type { RenderOptions } from '../ink.js'
import { isEnvTruthy } from './envUtils.js'
import { logError } from './log.js'
import { setWindowsConsoleRawMode } from './windowsConsoleMode.js'
import { isBlinkRuntime } from './blinkRuntime.js'

// Cached stdin override - computed once per process
let cachedStdinOverride: ReadStream | undefined | null = null
let cachedUsesFakeRawMode: boolean | null = null
let cachedSkipTerminalQueries: boolean | null = null

type PatchedStdin = NodeJS.ReadStream & {
  isRaw?: boolean
  setRawMode?: (raw: boolean) => void
  __blinkNativeRawMode?: boolean
  __blinkFakeRawMode?: boolean
}

function usesFakeRawMode(stream: NodeJS.ReadStream): boolean {
  return !!(stream as PatchedStdin).__blinkFakeRawMode
}

/** Native setRawMode works (no swallowing errors). */
function nativeRawModeWorks(stream: NodeJS.ReadStream): boolean {
  if (!stream.isTTY || typeof stream.setRawMode !== 'function') {
    return false
  }
  try {
    const wasRaw = (stream as PatchedStdin).isRaw === true
    stream.setRawMode(false)
    if (wasRaw) {
      stream.setRawMode(true)
    }
    return true
  } catch {
    return false
  }
}

function patchWindowsInteractiveStdin(stream: NodeJS.ReadStream): NodeJS.ReadStream {
  if (
    process.platform !== 'win32' ||
    !isEnvTruthy(process.env.BLINK_FORCE_INTERACTIVE)
  ) {
    return stream
  }

  const tty = stream as PatchedStdin
  if (tty.__blinkNativeRawMode !== undefined) {
    return tty
  }

  if (nativeRawModeWorks(stream)) {
    tty.__blinkNativeRawMode = true
    return tty
  }

  const nativeSetRawMode =
    typeof tty.setRawMode === 'function'
      ? tty.setRawMode.bind(tty)
      : undefined

  if (!tty.isTTY) {
    tty.isTTY = true
  }

  tty.setRawMode = (raw: boolean) => {
    let realRaw = false
    try {
      nativeSetRawMode?.(raw)
      realRaw = true
    } catch {
      realRaw = setWindowsConsoleRawMode(raw)
    }
    tty.isRaw = raw
    tty.__blinkFakeRawMode = raw && !realRaw
    if (tty.__blinkFakeRawMode) {
      process.env.BLINK_SKIP_TERMINAL_QUERIES = '1'
      cachedSkipTerminalQueries = true
    }
  }
  tty.__blinkNativeRawMode = false
  return tty
}

function tryRawMode(stream: NodeJS.ReadStream): boolean {
  if (nativeRawModeWorks(stream)) {
    if (!stream.isTTY) {
      stream.isTTY = true
    }
    return true
  }

  const patched = patchWindowsInteractiveStdin(stream)
  if (typeof patched.setRawMode !== 'function') {
    return false
  }
  try {
    patched.setRawMode(false)
    return !usesFakeRawMode(patched)
  } catch {
    return setWindowsConsoleRawMode(false)
  }
}

function stdinSupportsRawMode(
  stream: NodeJS.ReadStream = process.stdin,
): boolean {
  return tryRawMode(stream)
}

function openWindowsConsoleStdin(): ReadStream | undefined {
  for (const device of ['\\\\.\\CONIN$', 'CONIN$'] as const) {
    try {
      const ttyFd = openSync(device, 'r')
      const ttyStream = new ReadStream(ttyFd)
      ttyStream.isTTY = true
      if (tryRawMode(ttyStream)) {
        return patchWindowsInteractiveStdin(ttyStream) as ReadStream
      }
      ttyStream.destroy()
    } catch {
      // Try next device path form.
    }
  }
  return undefined
}

/**
 * Gets a ReadStream for /dev/tty when stdin is piped.
 * This allows interactive Ink rendering even when stdin is a pipe.
 * Result is cached for the lifetime of the process.
 */
function getStdinOverride(): ReadStream | undefined {
  // Return cached result if already computed
  if (cachedStdinOverride !== null) {
    return cachedStdinOverride
  }

  // Prefer inherited stdin when it already supports real raw mode (Cursor,
  // Windows Terminal, etc.). CONIN$ splits stdin from stdout and breaks
  // terminal query/response pairing — responses leak as visible garbage.
  if (stdinSupportsRawMode(process.stdin)) {
    cachedStdinOverride = undefined
    cachedUsesFakeRawMode = usesFakeRawMode(
      patchWindowsInteractiveStdin(process.stdin),
    )
    return undefined
  }

  // Windows + Blink launcher: fall back to CONIN$ only when inherited stdin
  // cannot enable raw mode (piped npm wrapper, etc.).
  if (
    process.platform === 'win32' &&
    isEnvTruthy(process.env.BLINK_FORCE_INTERACTIVE)
  ) {
    const winStdin = openWindowsConsoleStdin()
    if (winStdin) {
      cachedStdinOverride = winStdin
      cachedUsesFakeRawMode = usesFakeRawMode(winStdin)
      if (cachedUsesFakeRawMode) {
        process.env.BLINK_SKIP_TERMINAL_QUERIES = '1'
        cachedSkipTerminalQueries = true
      }
      return winStdin
    }
  }

  // Skip in CI environments (unless Blink explicitly forces interactive UI)
  if (
    isEnvTruthy(process.env.CI) &&
    !isEnvTruthy(process.env.BLINK_FORCE_INTERACTIVE)
  ) {
    cachedStdinOverride = undefined
    cachedUsesFakeRawMode = false
    return undefined
  }

  // Skip if running MCP (input hijacking breaks MCP)
  if (process.argv.includes('mcp')) {
    cachedStdinOverride = undefined
    cachedUsesFakeRawMode = false
    return undefined
  }

  // Windows fallback when not launched via Blink (e.g. raw bun cli.tsx).
  if (process.platform === 'win32') {
    const winStdin = openWindowsConsoleStdin()
    cachedStdinOverride = winStdin
    cachedUsesFakeRawMode = winStdin ? usesFakeRawMode(winStdin) : false
    return cachedStdinOverride
  }

  // Try to open /dev/tty as an alternative input source (Unix)
  try {
    const ttyFd = openSync('/dev/tty', 'r')
    const ttyStream = new ReadStream(ttyFd)
    ttyStream.isTTY = true
    if (tryRawMode(ttyStream)) {
      cachedStdinOverride = ttyStream
      cachedUsesFakeRawMode = usesFakeRawMode(ttyStream)
      return cachedStdinOverride
    }
    ttyStream.destroy()
  } catch (err) {
    logError(err as Error)
  }
  cachedStdinOverride = undefined
  cachedUsesFakeRawMode = false
  return undefined
}

/** Stdin stream Ink and early-input capture should use. */
export function getInteractiveStdin(): NodeJS.ReadStream {
  const override = getStdinOverride()
  const stream = override ?? process.stdin
  return patchWindowsInteractiveStdin(stream)
}

/** Skip Ink terminal capability probes (DA1/XTVERSION) — avoids escape leaks. */
export function shouldSkipTerminalQueries(): boolean {
  if (cachedSkipTerminalQueries !== null) {
    return cachedSkipTerminalQueries
  }
  if (isEnvTruthy(process.env.BLINK_SKIP_TERMINAL_QUERIES)) {
    cachedSkipTerminalQueries = true
    return true
  }
  if (process.env.TERM_PROGRAM === 'vscode') {
    cachedSkipTerminalQueries = true
    return true
  }
  // Windows + alt-screen: DA1 round-trips echo as ^[[?61;...c when raw mode
  // is flaky (Bun, integrated terminals, fullscreen resize).
  if (process.platform === 'win32' && isBlinkRuntime()) {
    cachedSkipTerminalQueries = true
    return true
  }
  if (process.env.WT_SESSION) {
    cachedSkipTerminalQueries = true
    return true
  }
  getStdinOverride()
  const skip =
    cachedSkipTerminalQueries === true || cachedUsesFakeRawMode === true
  if (skip) {
    cachedSkipTerminalQueries = true
  }
  return skip
}

/** True when Ink can enable raw mode (native stdin TTY or platform override). */
export function hasInteractiveStdin(): boolean {
  if (stdinSupportsRawMode(process.stdin)) {
    return true
  }
  if (
    process.platform === 'win32' &&
    isEnvTruthy(process.env.BLINK_FORCE_INTERACTIVE)
  ) {
    return (
      getStdinOverride() !== undefined ||
      setWindowsConsoleRawMode(false)
    )
  }
  return getStdinOverride() !== undefined
}

/**
 * Returns base render options for Ink, including stdin override when needed.
 * Use this for all render() calls to ensure piped input works correctly.
 *
 * @param exitOnCtrlC - Whether to exit on Ctrl+C (usually false for dialogs)
 */
export function getBaseRenderOptions(
  exitOnCtrlC: boolean = false,
): RenderOptions {
  const options: RenderOptions = { exitOnCtrlC }

  const stdin = getStdinOverride()
  if (stdin) {
    options.stdin = patchWindowsInteractiveStdin(stdin)
    return options
  }

  if (
    process.platform === 'win32' &&
    isEnvTruthy(process.env.BLINK_FORCE_INTERACTIVE)
  ) {
    options.stdin = getInteractiveStdin()
  }

  return options
}

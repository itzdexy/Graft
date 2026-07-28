/**
 * Early Input Capture
 *
 * This module captures terminal input that is typed before the REPL is fully
 * initialized. Users often type `tovyr` and immediately start typing their
 * prompt, but those early keystrokes would otherwise be lost during startup.
 *
 * Usage:
 * 1. Call startCapturingEarlyInput() as early as possible in cli.tsx
 * 2. When REPL is ready, call consumeEarlyInput() to get any buffered text
 * 3. stopCapturingEarlyInput() is called automatically when input is consumed
 */

import { lastGrapheme } from './intl.js'
import { isEnvTruthy } from './envUtils.js'
import { getInteractiveStdin } from './renderOptions.js'
import { setWindowsConsoleRawMode } from './windowsConsoleMode.js'

// Buffer for early input characters
let earlyInputBuffer = ''
// Flag to track if we're currently capturing
let isCapturing = false
// Reference to the readable handler so we can remove it later
let readableHandler: (() => void) | null = null
let captureStdin: NodeJS.ReadStream | null = null

/**
 * Start capturing stdin data early, before the REPL is initialized.
 * Should be called as early as possible in the startup sequence.
 *
 * Only captures if stdin is a TTY (interactive terminal).
 */
export function startCapturingEarlyInput(): void {
  // Only capture in interactive mode: stdin must be a TTY, and we must not
  // be in print mode. Raw mode disables ISIG (terminal Ctrl+C → SIGINT),
  // which would make -p uninterruptible.
  const stdin = getInteractiveStdin()
  const canCapture =
    stdin.isTTY ||
    (process.platform === 'win32' &&
      isEnvTruthy(process.env.TOVYR_FORCE_INTERACTIVE))
  if (
    !canCapture ||
    isCapturing ||
    process.argv.includes('-p') ||
    process.argv.includes('--print')
  ) {
    return
  }

  isCapturing = true
  earlyInputBuffer = ''
  captureStdin = stdin

  // Set stdin to raw mode and use 'readable' event like Ink does
  // This ensures compatibility with how the REPL will handle stdin later
  try {
    stdin.setEncoding('utf8')
    try {
      stdin.setRawMode(true)
    } catch {
      if (!setWindowsConsoleRawMode(true)) {
        throw new Error('raw mode unavailable')
      }
      ;(stdin as { isRaw?: boolean }).isRaw = true
    }
    // Raw mode shows a tovyring caret on many Windows hosts — hide it while
    // the startup loader owns the screen. Ink restores the cursor when ready.
    if (process.stderr.isTTY) {
      process.stderr.write('\x1b[?25l')
    }
    if (typeof stdin.ref === 'function') {
      stdin.ref()
    }

    readableHandler = () => {
      let chunk = stdin.read()
      while (chunk !== null) {
        if (typeof chunk === 'string') {
          processChunk(chunk)
        }
        chunk = stdin.read()
      }
    }

    stdin.on('readable', readableHandler)
  } catch {
    // If we can't set raw mode, just silently continue without early capture
    isCapturing = false
    captureStdin = null
  }
}

/**
 * Process a chunk of input data
 */
function processChunk(str: string): void {
  let i = 0
  while (i < str.length) {
    const char = str[i]!
    const code = char.charCodeAt(0)

    // Ctrl+C (code 3) - stop capturing and exit immediately.
    // We use process.exit here instead of gracefulShutdown because at this
    // early stage of startup, the shutdown machinery isn't initialized yet.
    if (code === 3) {
      stopCapturingEarlyInput()
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(130) // Standard exit code for Ctrl+C
      return
    }

    // Ctrl+D (code 4) - EOF, stop capturing
    if (code === 4) {
      stopCapturingEarlyInput()
      return
    }

    // Backspace (code 127 or 8) - remove last grapheme cluster
    if (code === 127 || code === 8) {
      if (earlyInputBuffer.length > 0) {
        const last = lastGrapheme(earlyInputBuffer)
        earlyInputBuffer = earlyInputBuffer.slice(0, -(last.length || 1))
      }
      i++
      continue
    }

    // Skip escape sequences (arrow keys, function keys, focus events, etc.)
    // All escape sequences start with ESC (0x1B) and end with a byte in 0x40-0x7E
    if (code === 27) {
      i++ // Skip the ESC character
      // Skip until the terminating byte (@ to ~) or end of string
      while (
        i < str.length &&
        !(str.charCodeAt(i) >= 64 && str.charCodeAt(i) <= 126)
      ) {
        i++
      }
      if (i < str.length) i++ // Skip the terminating byte
      continue
    }

    // Skip other control characters (except tab and newline)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      i++
      continue
    }

    // Convert carriage return to newline
    if (code === 13) {
      earlyInputBuffer += '\n'
      i++
      continue
    }

    // Add printable characters and allowed control chars to buffer
    earlyInputBuffer += char
    i++
  }
}

/**
 * Stop capturing early input.
 * Called automatically when input is consumed, or can be called manually.
 */
export function stopCapturingEarlyInput(): void {
  if (!isCapturing) {
    return
  }

  isCapturing = false

  if (readableHandler && captureStdin) {
    captureStdin.removeListener('readable', readableHandler)
    readableHandler = null
    captureStdin = null
  }

  // Don't reset stdin state - the REPL's Ink App will manage stdin state.
  // If we call setRawMode(false) here, it can interfere with the REPL's
  // own stdin setup which happens around the same time.
}

export type EarlyInputConsumption = {
  /** Text to pre-fill in the prompt (without trailing newlines). */
  text: string
  /** True when the user pressed Enter while typing during startup. */
  shouldSubmit: boolean
}

/**
 * Consume any early input that was captured.
 * Returns the captured input and clears the buffer.
 * Automatically stops capturing when called.
 */
export function consumeEarlyInput(): EarlyInputConsumption {
  stopCapturingEarlyInput()
  const raw = earlyInputBuffer
  earlyInputBuffer = ''
  const newlineIndex = raw.search(/\r\n|\n|\r/)
  const shouldSubmit = newlineIndex >= 0
  const text = (shouldSubmit ? raw.slice(0, newlineIndex) : raw).trimEnd()
  return { text, shouldSubmit }
}

/**
 * Check if there is any early input available without consuming it.
 */
export function hasEarlyInput(): boolean {
  return earlyInputBuffer.replace(/[\r\n]+$/, '').trim().length > 0
}

/**
 * Seed the early input buffer with text that will appear pre-filled
 * in the prompt input when the REPL renders. Does not auto-submit.
 */
export function seedEarlyInput(text: string): void {
  earlyInputBuffer = text
}

/**
 * Check if early input capture is currently active.
 */
export function isCapturingEarlyInput(): boolean {
  return isCapturing
}

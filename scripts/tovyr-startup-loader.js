/**
 * stderr startup loader for Node launchers (bin/tovyr.js, tovyr-warm.js).
 * Bun CLI entry re-exports this module via utils/tovyrStartupLoader.ts.
 *
 * Animation runs in a child process so it stays smooth while the parent
 * thread is blocked on Bun compile / module load.
 *
 * Centered full-viewport "Tovyr loading…" — cursor hidden so typing is not invited.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { TOVYR_PRODUCT_NAME, TOVYR_VERSION } from '../constants/tovyr.js'
import { TOVYR_TIPS } from '../constants/tovyrTips.js'

/** @typedef {'launch' | 'compile' | 'modules' | 'ui' | 'ready'} TovyrStartupPhase */

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const DOT_FRAMES = ['   ', '.  ', '.. ', '...']
/** Calm tick — Windows terminals choke on faster full-block redraws. */
const FRAME_MS = 120
const LOADER_PATH = fileURLToPath(import.meta.url)

/** Number of frames to hold each tip (≈ 6 seconds at 120ms/frame). */
const TIP_HOLD_FRAMES = 48

/** Content rows drawn each frame (excluding top pad). Tips add one line. */
function contentLines() {
  return shouldShowStartupTips() ? 7 : 6
}

/** @type {Record<TovyrStartupPhase, string>} */
const PHASE_LABEL = {
  launch: 'Starting up',
  compile: 'Compiling',
  modules: 'Loading modules',
  ui: 'Opening UI',
  ready: 'Ready',
}

let active = false
/** @type {TovyrStartupPhase} */
let phase = 'compile'
let frame = 0
let startedAt = 0
/** @type {ReturnType<typeof setInterval> | null} */
let timer = null
/** @type {import('node:child_process').ChildProcess | null} */
let animator = null
let reservedRows = 0
let cursorHidden = false
let exitHookInstalled = false

function useColor() {
  if (process.env.NO_COLOR) return false
  if (process.env.FORCE_COLOR === '0') return false
  return true
}

function ansi(code, text) {
  return useColor() ? `\x1b[${code}m${text}\x1b[0m` : text
}

function terminalColumns() {
  const cols = Number(process.env.TOVYR_STARTUP_COLS) ||
    process.stderr.columns ||
    process.stdout.columns ||
    80
  return Math.max(40, Math.min(cols, 120))
}

function terminalRows() {
  return (
    Number(process.env.TOVYR_STARTUP_ROWS) ||
    Math.max(12, process.stderr.rows || process.stdout.rows || 24)
  )
}

function visibleWidth(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, '').length
}

function center(text, width) {
  const pad = Math.max(0, Math.floor((width - visibleWidth(text)) / 2))
  return `${' '.repeat(pad)}${text}`
}

function hideCursor() {
  if (cursorHidden) return
  process.stderr.write('\x1b[?25l')
  cursorHidden = true
}

function showCursor() {
  if (!cursorHidden) return
  process.stderr.write('\x1b[?25h')
  cursorHidden = false
}

export function shouldShowTovyrStartupLoader() {
  if (process.env.TOVYR_NO_STARTUP_ANIM === '1') return false
  if (process.env.CI === 'true' || process.env.CI === '1') return false
  if (!process.stderr.isTTY) return false
  return (
    process.env.TOVYR_FORCE_INTERACTIVE === '1' ||
    process.env.TOVYR_PACKAGE_ROOT != null ||
    process.env.TOVYR_SRC != null
  )
}

export function shouldShowStartupTips() {
  if (process.env.TOVYR_NO_TIPS === '1') return false
  if (process.env.CI === 'true' || process.env.CI === '1') return false
  return true
}

/** @deprecated Kept for tests / callers; loader UI no longer shows a bar. */
export function formatProgressBar(progress, width = 18) {
  const clamped = Math.max(0, Math.min(1, progress))
  const filled = Math.round(clamped * width)
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`
}

export function formatElapsedSeconds(ms) {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function pickStartupTip(index) {
  if (!shouldShowStartupTips()) return ''
  return TOVYR_TIPS[index % TOVYR_TIPS.length]
}

/**
 * @param {{ phase: TovyrStartupPhase; frame: number; elapsedMs: number; tipIndex?: number; columns?: number; rows?: number }} input
 */
export function formatStartupLoaderFrame(input) {
  const cols = input.columns ?? terminalColumns()
  const spinner = SPINNER_FRAMES[input.frame % SPINNER_FRAMES.length]
  const dots = DOT_FRAMES[Math.floor(input.frame / 4) % DOT_FRAMES.length]
  const elapsed = formatElapsedSeconds(input.elapsedMs)
  const verb = PHASE_LABEL[input.phase] ?? 'loading'

  const brand = ansi('1;36', `${TOVYR_PRODUCT_NAME} Code`)
  const version = ansi('2', `v${TOVYR_VERSION}`)
  const loading = ansi('1;37', `loading${dots}`)
  const status = ansi('2', `${spinner}  ${verb}  ·  ${elapsed}`)

  const tipIndex =
    input.tipIndex ?? Math.floor(input.frame / TIP_HOLD_FRAMES)
  const tip = pickStartupTip(tipIndex)
  const tipLine = tip ? center(ansi('2', `Tip: ${tip}`), cols) : ''

  // Compact block — brand/version/loading/status, optional tip, trailing blank.
  const lines = [
    '',
    center(brand, cols),
    center(version, cols),
    center(loading, cols),
    center(status, cols),
  ]
  if (tipLine) {
    lines.push(tipLine)
  }
  lines.push('')
  return lines.join('\n')
}

function writeBlock(lines, topPad) {
  const parts = lines.split('\n')
  // One write: clear + paint. Avoid per-line flushes (laggy on Windows).
  let out = ''
  for (let i = 0; i < topPad; i++) {
    out += '\x1b[2K\n'
  }
  const lineCount = contentLines()
  for (let i = 0; i < lineCount; i++) {
    out += '\x1b[2K\x1b[0G'
    out += parts[i] ?? ''
    if (i < lineCount - 1) out += '\n'
  }
  process.stderr.write(out)
}

function clearReserved() {
  if (reservedRows <= 0) return
  process.stderr.write(`\x1b[${reservedRows}A\x1b[0J\x1b[0G`)
  reservedRows = 0
}

function renderFrame() {
  if (!active) return
  hideCursor()
  const rows = terminalRows()
  const linesCount = contentLines()
  const topPad = Math.max(0, Math.floor((rows - linesCount) / 2) - 1)
  const totalRows = topPad + linesCount
  const elapsedMs = Date.now() - startedAt
  const lines = formatStartupLoaderFrame({
    phase,
    frame,
    elapsedMs,
  })

  if (frame === 0 || totalRows !== reservedRows) {
    if (reservedRows > 0) {
      process.stderr.write(`\x1b[${reservedRows}A\x1b[0J`)
    }
    reservedRows = totalRows
    process.stderr.write(`${'\n'.repeat(totalRows)}`)
    process.stderr.write(`\x1b[${totalRows}A`)
  } else {
    process.stderr.write(`\x1b[${reservedRows}A`)
  }

  writeBlock(lines, topPad)
  frame += 1
}

function installExitHook() {
  if (exitHookInstalled) return
  exitHookInstalled = true
  const cleanup = () => {
    try {
      stopTovyrStartupLoader()
    } catch {
      /* ignore */
    }
  }
  process.once('exit', cleanup)
  process.once('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
  process.once('SIGTERM', () => {
    cleanup()
    process.exit(143)
  })
}

function sendAnimator(cmd) {
  if (!animator?.stdin?.writable) return false
  try {
    animator.stdin.write(`${cmd}\n`)
    return true
  } catch {
    return false
  }
}

function stopAnimatorProcess() {
  if (!animator) return
  const child = animator
  animator = null
  try {
    child.stdin?.end()
  } catch {
    /* ignore */
  }
  // Give the child a beat to clear the screen, then force-kill if needed.
  const killTimer = setTimeout(() => {
    try {
      child.kill()
    } catch {
      /* ignore */
    }
  }, 250)
  killTimer.unref?.()
  child.once('exit', () => clearTimeout(killTimer))
}

function startInProcessAnimator() {
  renderFrame()
  timer = setInterval(renderFrame, FRAME_MS)
  timer.unref?.()
}

function startChildAnimator() {
  const cols = String(process.stderr.columns || process.stdout.columns || 80)
  const rows = String(process.stderr.rows || process.stdout.rows || 24)
  const child = spawn(
    process.execPath,
    [LOADER_PATH],
    {
      stdio: ['pipe', 'ignore', 'inherit'],
      env: {
        ...process.env,
        TOVYR_STARTUP_ANIMATOR: '1',
        TOVYR_STARTUP_ANIMATOR_MAIN: '1',
        TOVYR_STARTUP_PHASE: phase,
        TOVYR_STARTUP_STARTED_AT: String(startedAt),
        TOVYR_STARTUP_COLS: cols,
        TOVYR_STARTUP_ROWS: rows,
        // Child owns the TTY paint loop — don't recurse into another spawn.
        TOVYR_NO_STARTUP_ANIM: '1',
      },
      windowsHide: true,
    },
  )
  animator = child
  child.on('exit', (code) => {
    if (animator === child) animator = null
    // Crash/early exit — keep a spinner going on the parent thread.
    if (active && code !== 0 && code !== null && !timer) {
      startInProcessAnimator()
    }
  })
  child.on('error', () => {
    if (animator === child) {
      animator = null
      if (active && !timer) startInProcessAnimator()
    }
  })
}

/** @param {TovyrStartupPhase} [initialPhase] */
export function startTovyrStartupLoader(initialPhase = 'compile') {
  // Animator child process must never spawn another animator.
  if (process.env.TOVYR_STARTUP_ANIMATOR_MAIN === '1') return
  if (!shouldShowTovyrStartupLoader() || active) return
  active = true
  phase =
    process.env.TOVYR_CACHE_WARMED === '1' && initialPhase === 'compile'
      ? 'modules'
      : initialPhase
  frame = 0
  startedAt = Date.now()
  hideCursor()
  installExitHook()

  // Prefer an out-of-process animator so frames keep ticking during compile.
  try {
    startChildAnimator()
  } catch {
    startInProcessAnimator()
  }
  if (!animator && !timer) startInProcessAnimator()
}

/** @param {TovyrStartupPhase} next */
export function setTovyrStartupPhase(next) {
  if (process.env.TOVYR_STARTUP_ANIMATOR === '1') {
    phase = next
    return
  }
  if (!active) return
  phase = next
  if (animator) {
    sendAnimator(`phase:${next}`)
    return
  }
  // In-process: paint immediately so phase changes feel snappy.
  renderFrame()
}

/**
 * @param {{ keepCursorHidden?: boolean }} [opts]
 */
export function stopTovyrStartupLoader(opts = {}) {
  if (process.env.TOVYR_STARTUP_ANIMATOR === '1') {
    active = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    clearReserved()
    if (!opts.keepCursorHidden) showCursor()
    return
  }
  if (!active) {
    if (!opts.keepCursorHidden) showCursor()
    return
  }
  active = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (animator) {
    sendAnimator(opts.keepCursorHidden ? 'stop:keep' : 'stop')
    stopAnimatorProcess()
    // Child clears its own reserved block on stop.
    reservedRows = 0
  } else {
    clearReserved()
  }
  if (opts.keepCursorHidden) {
    hideCursor()
  } else {
    showCursor()
  }
}

export function getTovyrStartupElapsedMs() {
  return startedAt > 0 ? Date.now() - startedAt : 0
}

// --- Child animator entry (TOVYR_STARTUP_ANIMATOR=1) ---
function runAnimatorChild() {
  active = true
  phase = /** @type {TovyrStartupPhase} */ (
    process.env.TOVYR_STARTUP_PHASE || 'compile'
  )
  startedAt = Number(process.env.TOVYR_STARTUP_STARTED_AT) || Date.now()
  frame = 0
  hideCursor()
  renderFrame()
  timer = setInterval(renderFrame, FRAME_MS)

  const onLine = (line) => {
    const cmd = line.trim()
    if (!cmd) return
    if (cmd === 'stop' || cmd.startsWith('stop:')) {
      // Ignore duplicate stop from stdin end after stop:keep
      if (!active) {
        process.exit(0)
        return
      }
      const keepCursor = cmd === 'stop:keep'
      if (timer) clearInterval(timer)
      timer = null
      active = false
      clearReserved()
      if (!keepCursor) showCursor()
      process.exit(0)
    }
    if (cmd.startsWith('phase:')) {
      phase = /** @type {TovyrStartupPhase} */ (cmd.slice(6) || phase)
    }
  }

  let buf = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => {
    buf += chunk
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      onLine(buf.slice(0, idx))
      buf = buf.slice(idx + 1)
    }
  })
  process.stdin.on('end', () => {
    if (active) onLine('stop')
    else process.exit(0)
  })
}

// Only when spawned as the animator process — not when this module is imported.
if (
  process.env.TOVYR_STARTUP_ANIMATOR === '1' &&
  process.env.TOVYR_STARTUP_ANIMATOR_MAIN === '1'
) {
  runAnimatorChild()
}

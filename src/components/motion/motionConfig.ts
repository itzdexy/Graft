/**
 * One switch for every animation in the UI.
 *
 * Motion in a terminal is not free the way it is in a browser: each frame is a
 * React re-render and a repaint of the whole line, so a spinner that keeps
 * ticking in CI or through a piped stdout burns cycles and floods logs with
 * escape sequences for nobody.
 *
 * Animated components should ask here rather than each inventing its own
 * "is this a TTY" check, so that a user who turns motion off gets a UI that is
 * genuinely still.
 */

/** Frame interval for decorative animation, in milliseconds. */
export const MOTION_FRAME_MS = 120

/** Slower cadence for things that read as status rather than motion. */
export const MOTION_STATUS_MS = 500

function envSaysOff(): boolean {
  const raw = process.env.TOVYR_NO_MOTION?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

/**
 * Whether decorative animation should run at all.
 *
 * Deliberately conservative: anything that is not an interactive terminal a
 * person is watching gets no motion. A spinner written to a pipe is pure
 * noise, and in CI it can multiply a log by a large factor.
 */
export function isMotionEnabled(): boolean {
  if (envSaysOff()) return false
  // CI and non-interactive runs: nobody is watching a frame counter.
  if (process.env.CI) return false
  if (process.env.NODE_ENV === 'test') return false
  // A launcher may force interactive mode where isTTY is unreliable (Windows
  // + Bun), so an explicit force wins over the isTTY probe.
  if (process.env.TOVYR_FORCE_INTERACTIVE === '1') return true
  return Boolean(process.stdout.isTTY)
}

/**
 * The interval an animated component should use, or `null` to hold still.
 *
 * `null` is the value `useInterval` already understands as "do not subscribe",
 * so a component can pass this straight through and drop off the shared clock
 * entirely when motion is off -- rather than continuing to tick and re-render
 * with an unchanged frame.
 */
export function motionInterval(ms: number = MOTION_FRAME_MS): number | null {
  return isMotionEnabled() ? ms : null
}

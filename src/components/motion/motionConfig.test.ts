import { afterEach, describe, expect, test } from 'bun:test'
import {
  MOTION_FRAME_MS,
  isMotionEnabled,
  motionInterval,
} from './motionConfig.js'

const saved = {
  TOVYR_NO_MOTION: process.env.TOVYR_NO_MOTION,
  CI: process.env.CI,
  NODE_ENV: process.env.NODE_ENV,
  TOVYR_FORCE_INTERACTIVE: process.env.TOVYR_FORCE_INTERACTIVE,
}

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function clearGuards(): void {
  delete process.env.TOVYR_NO_MOTION
  delete process.env.CI
  delete process.env.NODE_ENV
  delete process.env.TOVYR_FORCE_INTERACTIVE
}

describe('motion config', () => {
  test('TOVYR_NO_MOTION turns everything off', () => {
    clearGuards()
    process.env.TOVYR_FORCE_INTERACTIVE = '1'
    expect(isMotionEnabled()).toBe(true)
    process.env.TOVYR_NO_MOTION = '1'
    expect(isMotionEnabled()).toBe(false)
  })

  test('CI gets no motion', () => {
    clearGuards()
    process.env.TOVYR_FORCE_INTERACTIVE = '1'
    process.env.CI = 'true'
    // A spinner in CI is escape sequences written to a log nobody watches.
    expect(isMotionEnabled()).toBe(false)
  })

  test('tests get no motion', () => {
    clearGuards()
    process.env.TOVYR_FORCE_INTERACTIVE = '1'
    process.env.NODE_ENV = 'test'
    expect(isMotionEnabled()).toBe(false)
  })

  test('motionInterval returns null when motion is off', () => {
    clearGuards()
    process.env.TOVYR_NO_MOTION = '1'
    // null is what useInterval reads as "do not subscribe", so an off switch
    // takes the component off the shared clock rather than leaving it ticking
    // on an unchanged frame.
    expect(motionInterval()).toBeNull()
    expect(motionInterval(40)).toBeNull()
  })

  test('motionInterval passes the cadence through when motion is on', () => {
    clearGuards()
    process.env.TOVYR_FORCE_INTERACTIVE = '1'
    expect(motionInterval()).toBe(MOTION_FRAME_MS)
    expect(motionInterval(40)).toBe(40)
  })
})

describe('animated components stay on the shared clock', () => {
  test('no UI component owns a private animation timer', async () => {
    // ink/components/ClockContext already provides a single clock that all of
    // Ink's rendering shares: it aligns frames, throttles when the terminal
    // loses focus, and stops entirely when nothing is animating. A component
    // that calls setInterval directly opts out of all three and adds a wakeup
    // per instance, which is what this guards against.
    const { Glob } = await import('bun')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join, sep } = await import('node:path')

    const componentsDir = join(
      dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
      'components',
    )

    // Polling for external state is a different job from animating, and the
    // shared clock is the wrong tool for a 30-second update check.
    const pollers = new Set([
      'TovyrGitHubUpdateNotice.tsx',
      'Notifications.tsx',
      'ScrollKeybindingHandler.tsx',
      'ShellDetailDialog.tsx',
      'CoordinatorAgentStatus.tsx',
      'PromptInputFooterLeftSide.tsx',
      'ActivityClawd.tsx',
      'useShimmerAnimation.ts',
    ])

    const offenders: string[] = []
    for await (const file of new Glob('**/*.{ts,tsx}').scan({
      cwd: componentsDir,
      absolute: true,
    })) {
      if (file.includes('.test.')) continue
      const name = file.split(sep).pop()!
      if (pollers.has(name)) continue
      const text = await Bun.file(file).text()
      if (text.includes('setInterval(')) offenders.push(name)
    }
    expect(offenders).toEqual([])
  }, 60_000)
})

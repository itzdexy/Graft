import { describe, expect, test } from 'bun:test'
import { createIdleGcScheduler } from './idleGcScheduler.js'

describe('idle GC scheduler', () => {
  test('does not force GC during an active run', () => {
    let now = 60_000
    let collections = 0
    const scheduler = createIdleGcScheduler({
      now: () => now,
      lastActivityAt: () => 0,
      isActiveRun: () => true,
      heapUsed: () => 2 * 1024 * 1024 * 1024,
      collect: () => {
        collections += 1
      },
    })

    expect(scheduler.tick()).toBe(false)
    now += 60_000
    expect(scheduler.tick()).toBe(false)
    expect(collections).toBe(0)
  })

  test('does not collect immediately after user activity', () => {
    let collections = 0
    const scheduler = createIdleGcScheduler({
      now: () => 100_000,
      lastActivityAt: () => 99_000,
      isActiveRun: () => false,
      heapUsed: () => 2 * 1024 * 1024 * 1024,
      collect: () => {
        collections += 1
      },
    })

    expect(scheduler.tick()).toBe(false)
    expect(collections).toBe(0)
  })

  test('collects once under idle heap pressure and respects cooldown', () => {
    let now = 120_000
    let collections = 0
    const scheduler = createIdleGcScheduler({
      now: () => now,
      lastActivityAt: () => 0,
      heapUsed: () => 2 * 1024 * 1024 * 1024,
      collect: () => {
        collections += 1
      },
      idleGraceMs: 30_000,
      cooldownMs: 5 * 60_000,
    })

    expect(scheduler.tick()).toBe(true)
    expect(scheduler.tick()).toBe(false)
    now += 5 * 60_000
    expect(scheduler.tick()).toBe(true)
    expect(collections).toBe(2)
  })

  test('skips idle collection below the heap threshold', () => {
    const scheduler = createIdleGcScheduler({
      now: () => 120_000,
      lastActivityAt: () => 0,
      heapUsed: () => 128 * 1024 * 1024,
      collect: () => {
        throw new Error('collection must not run')
      },
    })

    expect(scheduler.tick()).toBe(false)
  })
})

export const DEFAULT_IDLE_GC_GRACE_MS = 30_000
export const DEFAULT_IDLE_GC_COOLDOWN_MS = 5 * 60_000
export const DEFAULT_IDLE_GC_HEAP_THRESHOLD_BYTES = 1024 * 1024 * 1024
export const DEFAULT_IDLE_GC_SAMPLE_MS = 30_000

export type IdleGcSchedulerOptions = {
  now: () => number
  lastActivityAt: () => number
  isActiveRun?: () => boolean
  heapUsed: () => number
  collect: (full?: boolean) => void
  idleGraceMs?: number
  cooldownMs?: number
  heapThresholdBytes?: number
}

export function createIdleGcScheduler(options: IdleGcSchedulerOptions): {
  tick: () => boolean
} {
  const idleGraceMs =
    options.idleGraceMs ?? DEFAULT_IDLE_GC_GRACE_MS
  const cooldownMs = options.cooldownMs ?? DEFAULT_IDLE_GC_COOLDOWN_MS
  const heapThresholdBytes =
    options.heapThresholdBytes ?? DEFAULT_IDLE_GC_HEAP_THRESHOLD_BYTES
  let lastCollectionAt = Number.NEGATIVE_INFINITY

  return {
    tick(): boolean {
      const now = options.now()
      if (options.isActiveRun?.()) return false
      if (now - options.lastActivityAt() < idleGraceMs) return false
      if (options.heapUsed() < heapThresholdBytes) return false
      if (now - lastCollectionAt < cooldownMs) return false
      options.collect(true)
      lastCollectionAt = now
      return true
    },
  }
}

export function startIdleGcScheduler(options: {
  lastActivityAt: () => number
  isActiveRun: () => boolean
  sampleMs?: number
}): () => void {
  if (typeof Bun === 'undefined' || typeof Bun.gc !== 'function') return () => {}
  const scheduler = createIdleGcScheduler({
    now: Date.now,
    lastActivityAt: options.lastActivityAt,
    isActiveRun: options.isActiveRun,
    heapUsed: () => process.memoryUsage().heapUsed,
    collect: full => Bun.gc(full),
  })
  const timer = setInterval(
    () => scheduler.tick(),
    options.sampleMs ?? DEFAULT_IDLE_GC_SAMPLE_MS,
  )
  timer.unref()
  return () => clearInterval(timer)
}

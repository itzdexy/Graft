export type FpsMetrics = {
  averageFps: number
  low1PctFps: number
}

const MAX_FRAME_SAMPLES = 3600
const RETAINED_FRAME_SAMPLES = MAX_FRAME_SAMPLES / 2

type FrameSample = {
  durationMs: number
  recordedAt: number
}

export class FpsTracker {
  // A long interactive session must not retain one object per rendered frame.
  // Keep a rolling window large enough for useful 1% low metrics.
  private frameSamples: FrameSample[] = []

  record(durationMs: number): void {
    const now = performance.now()
    this.frameSamples.push({ durationMs, recordedAt: now })
    if (this.frameSamples.length > MAX_FRAME_SAMPLES) {
      this.frameSamples.splice(
        0,
        this.frameSamples.length - RETAINED_FRAME_SAMPLES,
      )
    }
  }

  getMetrics(): FpsMetrics | undefined {
    if (this.frameSamples.length === 0) return undefined

    const first = this.frameSamples[0]!
    const last = this.frameSamples.at(-1)!
    const totalTimeMs = last.recordedAt - first.recordedAt
    if (totalTimeMs <= 0) {
      return undefined
    }

    const totalFrames = this.frameSamples.length
    const averageFps = totalFrames / (totalTimeMs / 1000)

    const sorted = this.frameSamples
      .map(sample => sample.durationMs)
      .sort((a, b) => b - a)
    const p99Index = Math.max(0, Math.ceil(sorted.length * 0.01) - 1)
    const p99FrameTimeMs = sorted[p99Index]!
    const low1PctFps = p99FrameTimeMs > 0 ? 1000 / p99FrameTimeMs : 0

    return {
      averageFps: Math.round(averageFps * 100) / 100,
      low1PctFps: Math.round(low1PctFps * 100) / 100,
    }
  }
}

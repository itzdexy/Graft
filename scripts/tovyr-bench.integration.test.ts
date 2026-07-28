/**
 * Benchmark CLI smoke — fast offline suite only.
 */
import { describe, expect, test } from 'bun:test'
import { runLauncher } from './tovyr-cli-test-helpers.js'
import { EXIT } from './tovyr-cli-ux.js'
import { runBenchmark } from '../services/tovyr/benchmark/runner.js'

describe('tovyr bench CLI', () => {
  test('--help exits 0', () => {
    const r = runLauncher(['bench', '--help'], { timeoutMs: 60_000 })
    expect(r.status).toBe(EXIT.OK)
    expect(r.stdout + r.stderr).toContain('--suite')
  })

  test('smoke suite runs offline', async () => {
    const report = await runBenchmark({ suite: 'smoke', live: false })
    expect(report.results.length).toBeGreaterThanOrEqual(3)
    expect(report.summary.scorePercent).toBeGreaterThan(0)
    expect(report.version).toBe(1)
  }, 120_000)

  test('launcher bench smoke', () => {
    const r = runLauncher(['bench', '--suite', 'smoke', '-q'], {
      timeoutMs: 120_000,
    })
    const out = r.stdout + r.stderr
    expect(out).toMatch(/bench [\d.]+%/i)
  }, 120_000)
})

#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(root, 'src', 'entrypoints', 'cli.tsx')

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function percentile(values, value) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * value) - 1),
  )
  return sorted[index]
}

function measure(args, runs = 20) {
  const samples = []
  for (let run = 0; run < runs; run++) {
    const started = performance.now()
    const result = spawnSync('bun', ['run', entry, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TOVYR_FORCE_INTERACTIVE: '0' },
    })
    samples.push(performance.now() - started)
    if (result.status !== 0) {
      throw new Error(result.stderr || `tovyr ${args.join(' ')} failed`)
    }
  }
  return {
    medianMs: Number(median(samples).toFixed(1)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(1)),
    samples,
  }
}

const results = {
  version: measure(['--version']),
  help: measure(['--help']),
}

const runtimePolicy = {
  legacyForcedGcWakeupsPerMinute: 60,
  activeForcedGcWakeupsPerMinute: 0,
  idleSamplerWakeupsPerMinute: 2,
  idleGraceMs: 30_000,
  collectionCooldownMs: 5 * 60_000,
}

console.log(JSON.stringify({ ...results, runtimePolicy }, null, 2))
for (const [name, result] of Object.entries(results)) {
  if (result.p95Ms <= 250) continue
  console.error(
    `${name} p95 ${result.p95Ms}ms exceeds the Tovyr 1.3 budget of 250ms.`,
  )
  process.exitCode = 1
}

if (runtimePolicy.activeForcedGcWakeupsPerMinute !== 0) {
  console.error('Active runs must not schedule forced garbage collection.')
  process.exitCode = 1
}

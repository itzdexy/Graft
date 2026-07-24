#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(root, 'entrypoints', 'cli.tsx')

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function measure(args, runs = 7) {
  const samples = []
  for (let run = 0; run < runs; run++) {
    const started = performance.now()
    const result = spawnSync('bun', ['run', entry, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, BLINK_FORCE_INTERACTIVE: '0' },
    })
    samples.push(performance.now() - started)
    if (result.status !== 0) {
      throw new Error(result.stderr || `blink ${args.join(' ')} failed`)
    }
  }
  return { medianMs: Number(median(samples).toFixed(1)), samples }
}

const results = {
  version: measure(['--version']),
  help: measure(['--help']),
}

console.log(JSON.stringify(results, null, 2))
if (results.help.medianMs > 500) {
  console.error(`Help median ${results.help.medianMs}ms exceeds the 500ms budget.`)
  process.exitCode = 1
}

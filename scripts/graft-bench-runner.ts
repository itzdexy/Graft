#!/usr/bin/env bun
/**
 * Benchmark runner entry — invoked by scripts/graft-bench-cli.js
 */
import {
  formatBenchCompareHuman,
  formatBenchReportHuman,
} from '../src/services/graft/benchmark/report.js'
import {
  loadBenchmarkReport,
  runBenchmark,
  saveBenchmarkReport,
} from '../src/services/graft/benchmark/runner.js'
import { BENCH_SUITES } from '../src/services/graft/benchmark/suites.js'

const args = process.argv.slice(2)
const json = args.includes('--json') || process.env.GRAFT_JSON === '1'
const live = args.includes('--live')
const quiet =
  args.includes('--quiet') ||
  args.includes('-q') ||
  process.env.GRAFT_QUIET === '1'

function flagValue(name: string): string | undefined {
  const i = args.indexOf(name)
  if (i >= 0 && i + 1 < args.length) return args[i + 1]
  const eq = args.find(a => a.startsWith(`${name}=`))
  return eq?.slice(name.length + 1)
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: graft bench [command] [options]

Commands:
  (default)     Run benchmark suite
  compare       Compare latest vs previous run
  list          List suites and cases

Suites:
${Object.entries(BENCH_SUITES)
  .map(([k, v]) => `  ${k.padEnd(10)} ${v}`)
  .join('\n')}

Options:
  --suite <name>   smoke | offline | live | full (default: offline)
  --live           Include live API probes (needs API key)
  --timeout <ms>   Per live prompt timeout (default: 120000)
  --json           Machine-readable output
  -q, --quiet      Only print score line

Examples:
  graft bench
  graft bench --suite smoke
  graft bench --live --suite full
  graft bench --json
  graft bench compare
`)
  process.exit(0)
}

const sub = args[0]

if (sub === 'list') {
  const { OFFLINE_CASES, LIVE_CASES } = await import(
    '../src/services/graft/benchmark/suites.js'
  )
  console.log('Offline cases:')
  for (const c of OFFLINE_CASES) {
    console.log(`  ${c.id.padEnd(20)} ${c.name}`)
  }
  console.log('\nLive cases (need API key):')
  for (const c of LIVE_CASES) {
    console.log(`  ${c.id.padEnd(20)} ${c.name}`)
  }
  process.exit(0)
}

if (sub === 'compare') {
  const current = loadBenchmarkReport('latest')
  const previous = loadBenchmarkReport('previous')
  if (!current || !previous) {
    console.error('Need at least two runs (latest.json and previous.json in .graft/benchmarks/)')
    process.exit(1)
  }
  if (json) {
    console.log(
      JSON.stringify(
        {
          current: current.summary,
          previous: previous.summary,
          delta: current.summary.scorePercent - previous.summary.scorePercent,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(formatBenchCompareHuman(current, previous))
  }
  process.exit(0)
}

const suiteRaw = flagValue('--suite') ?? (live ? 'full' : 'offline')
const suite = suiteRaw as keyof typeof BENCH_SUITES
if (!(suite in BENCH_SUITES)) {
  console.error(`Unknown suite: ${suiteRaw}. Use: graft bench list`)
  process.exit(2)
}

const timeoutRaw = flagValue('--timeout')
const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : 120_000

const report = await runBenchmark({
  suite,
  live: live || suite === 'live',
  timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 120_000,
})

const { latestPath } = saveBenchmarkReport(report)

if (json) {
  console.log(JSON.stringify({ ...report, savedTo: latestPath }, null, 2))
} else if (quiet) {
  console.log(
    `bench ${report.summary.scorePercent}% (${report.summary.passed}/${report.summary.total}) · ${(report.durationMs / 1000).toFixed(1)}s`,
  )
} else {
  console.log(formatBenchReportHuman({ ...report, suite }))
}

process.exit(report.summary.failed > 0 ? 1 : 0)

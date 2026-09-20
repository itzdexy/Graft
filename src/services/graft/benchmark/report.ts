import type { BenchRunReport } from './types.js'

export function formatBenchReportHuman(report: BenchRunReport): string {
  const { summary, results } = report
  const lines: string[] = [
    `Graft benchmark — suite: ${report.suite}`,
    `Score: ${summary.scorePercent}% (${summary.passed}/${summary.total} passed)`,
    `Duration: ${(report.durationMs / 1000).toFixed(1)}s`,
  ]

  if (report.provider) {
    lines.push(`Provider: ${report.provider}${report.model ? ` · ${report.model}` : ''}`)
  }

  lines.push('', 'Results:')

  for (const r of results) {
    const icon = r.passed ? '✓' : '✗'
    const ms = `${r.durationMs}ms`
    lines.push(
      `  ${icon} ${r.name} [${r.category}] ${ms}${r.detail ? ` — ${r.detail}` : ''}`,
    )
    if (!r.passed && r.error) {
      lines.push(`      ${r.error}`)
    }
  }

  lines.push('', 'By category:')
  for (const [cat, stats] of Object.entries(summary.byCategory)) {
    lines.push(`  ${cat}: ${stats.passed}/${stats.total}`)
  }

  if (!summary.liveIncluded && report.suite === 'full') {
    lines.push(
      '',
      'Tip: run `graft bench --live` to score model latency and quality (needs API key).',
    )
  }

  lines.push(
    '',
    `Report saved: .graft/benchmarks/latest.json`,
    'Compare runs: graft bench compare',
  )

  return lines.join('\n')
}

export function formatBenchCompareHuman(
  current: BenchRunReport,
  previous: BenchRunReport,
): string {
  const delta = current.summary.scorePercent - previous.summary.scorePercent
  const sign = delta >= 0 ? '+' : ''
  const lines = [
    'Graft benchmark compare',
    '',
    `Previous (${previous.startedAt.slice(0, 19)}): ${previous.summary.scorePercent}%`,
    `Current  (${current.startedAt.slice(0, 19)}): ${current.summary.scorePercent}%`,
    `Delta: ${sign}${delta.toFixed(1)} pts`,
    '',
  ]

  const prevById = new Map(previous.results.map(r => [r.id, r]))
  for (const r of current.results) {
    const prev = prevById.get(r.id)
    if (!prev) {
      lines.push(`  + ${r.id} (new)`)
      continue
    }
    if (prev.passed !== r.passed) {
      lines.push(
        `  ${r.passed ? '↑' : '↓'} ${r.id}: ${prev.passed ? 'pass' : 'fail'} → ${r.passed ? 'pass' : 'fail'}`,
      )
    } else if (r.mode === 'live' && Math.abs(r.durationMs - prev.durationMs) > 500) {
      const d = r.durationMs - prev.durationMs
      lines.push(
        `  ~ ${r.id}: ${prev.durationMs}ms → ${r.durationMs}ms (${d > 0 ? '+' : ''}${d}ms)`,
      )
    }
  }

  return lines.join('\n')
}

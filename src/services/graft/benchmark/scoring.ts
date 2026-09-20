import type { BenchCaseResult, BenchSummary } from './types.js'

export function summarizeResults(
  results: BenchCaseResult[],
  liveIncluded: boolean,
): BenchSummary {
  const total = results.length
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const skipped = 0

  let score = 0
  let maxScore = 0
  const byCategory: BenchSummary['byCategory'] = {}

  for (const r of results) {
    maxScore += r.weight * 100
    score += r.passed ? r.weight * r.score : 0

    const cat = byCategory[r.category] ?? { passed: 0, total: 0, score: 0 }
    cat.total++
    if (r.passed) {
      cat.passed++
      cat.score += r.weight * r.score
    }
    byCategory[r.category] = cat
  }

  const scorePercent =
    maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0

  return {
    total,
    passed,
    failed,
    skipped,
    score,
    maxScore,
    scorePercent,
    byCategory,
    liveIncluded,
  }
}

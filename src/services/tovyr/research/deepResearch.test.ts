import { describe, expect, test } from 'bun:test'
import {
  isLowQualitySource,
  filterQualitySources,
} from './sourceQuality.js'
import {
  currentResearchDateContext,
  deepResearchReportPath,
  parseDeepResearchArgs,
} from './deepResearch.js'

describe('sourceQuality', () => {
  test('flags cookie consent boilerplate', () => {
    expect(isLowQualitySource('This page is a cookie consent banner only')).toBe(true)
  })

  test('accepts substantive summaries', () => {
    expect(isLowQualitySource('Rust async runtimes compare Tokio and async-std.')).toBe(false)
  })

  test('filterQualitySources drops low quality', () => {
    const out = filterQualitySources([
      { summary: 'cookie consent banner' },
      { summary: 'Vector DB comparison with benchmarks' },
    ])
    expect(out).toHaveLength(1)
  })
})

describe('deepResearch', () => {
  test('parseDeepResearchArgs treats bare text as deep topic', () => {
    expect(parseDeepResearchArgs('best vector databases').topic).toBe('best vector databases')
  })

  test('deepResearchReportPath slugifies topic', () => {
    expect(deepResearchReportPath('Best Vector DBs?!')).toMatch(/^\.tovyr\/research\/best-vector-dbs-/)
  })

  test('currentResearchDateContext includes current year', () => {
    const year = String(new Date().getFullYear())
    expect(currentResearchDateContext()).toContain(year)
  })
})

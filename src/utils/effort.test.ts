import { describe, expect, test } from 'bun:test'
import {
  cycleEffortLevel,
  getDefaultEffortForModel,
  listEffortLevelsForModel,
  modelSupportsEffort,
  modelSupportsMaxEffort,
  resolveAppliedEffort,
  toPersistableEffort,
} from './effort.js'

describe('Muse Spark effort', () => {
  const spark = 'muse-spark-1.3-contributor'

  test('supports the four user-facing levels including max', () => {
    expect(modelSupportsEffort(spark)).toBe(true)
    expect(modelSupportsMaxEffort(spark)).toBe(true)
    expect(listEffortLevelsForModel(spark)).toEqual([
      'low',
      'medium',
      'high',
      'max',
    ])
  })

  test('defaults to high and persists max', () => {
    expect(getDefaultEffortForModel(spark)).toBe('high')
    expect(resolveAppliedEffort(spark, undefined)).toBe('high')
    expect(resolveAppliedEffort(spark, 'max')).toBe('max')
    expect(toPersistableEffort('max')).toBe('max')
  })

  test('cycles low → medium → high → max', () => {
    expect(cycleEffortLevel('high', 'right', spark)).toBe('max')
    expect(cycleEffortLevel('max', 'right', spark)).toBe('low')
    expect(cycleEffortLevel('low', 'left', spark)).toBe('max')
  })
})

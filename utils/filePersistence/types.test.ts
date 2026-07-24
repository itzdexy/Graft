import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_UPLOAD_CONCURRENCY,
  FILE_COUNT_LIMIT,
  OUTPUTS_SUBDIR,
} from './types.js'

describe('filePersistence types', () => {
  test('exports stable persistence constants', () => {
    expect(OUTPUTS_SUBDIR).toBe('outputs')
    expect(FILE_COUNT_LIMIT).toBeGreaterThan(0)
    expect(DEFAULT_UPLOAD_CONCURRENCY).toBeGreaterThan(0)
  })
})

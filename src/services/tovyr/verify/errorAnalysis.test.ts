import { describe, expect, test } from 'bun:test'
import {
  extractErrorsFromOutput,
  suggestFixStrategy,
  summarizeErrors,
} from './errorAnalysis.js'

describe('errorAnalysis', () => {
  test('parses TypeScript errors', () => {
    const out = 'src/foo.ts(12,3): error TS2345: Argument of type string is not assignable'
    const errors = extractErrorsFromOutput(out)
    expect(errors.length).toBe(1)
    expect(errors[0]?.file).toBe('src/foo.ts')
    expect(errors[0]?.line).toBe(12)
    expect(errors[0]?.code).toBe('TS2345')
  })

  test('summarizeErrors formats list', () => {
    const errors = extractErrorsFromOutput('src/a.ts(1,1): error TS1000: bad')
    expect(summarizeErrors(errors)).toContain('Parsed errors')
  })

  test('suggestFixStrategy for module not found', () => {
    const errors = [{ message: 'Cannot find module xyz', raw: 'Cannot find module xyz' }]
    const hints = suggestFixStrategy(errors)
    expect(hints.some(h => h.toLowerCase().includes('install'))).toBe(true)
  })
})

import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pkg from '../package.json'

const config = JSON.parse(
  readFileSync(new URL('../tsconfig.tovyr.json', import.meta.url), 'utf8'),
)

const TOVYR_CORE_FILES = [
  'utils/tovyrRuntime.ts',
  'services/tovyr/agent/mainLoopLimits.ts',
  'services/tovyr/providerErrors.ts',
  'services/tovyr/intent/filenameFromPrompt.ts',
  'services/tovyr/dx/waitStateCopy.ts',
  'services/tovyr/dx/thinkingDurations.ts',
  'services/tovyr/dx/requestTimeout.ts',
]

test('Tovyr exposes focused quality gates', () => {
  expect(pkg.scripts['typecheck:tovyr']).toBe('tsc -p tsconfig.tovyr.json')
  expect(pkg.scripts['check:tovyr']).toBe('node scripts/tovyr-quality-gates.js')
})

test('Tovyr typechecks an import-clean core slice', () => {
  expect(config.include).toEqual(TOVYR_CORE_FILES)
  expect(config.include.every(file => !file.includes('*'))).toBe(true)
  expect(config.exclude).toEqual(['**/*.test.ts', '**/*.test.tsx'])
})

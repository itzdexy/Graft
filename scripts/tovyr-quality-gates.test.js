import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pkg from '../package.json'

mock.module('node:child_process', () => ({
  spawnSync: () => ({ status: 0 }),
}))

const qualityGateRunner = await import('./tovyr-quality-gates.js')

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

test('quality runner launches every phase without a shell', () => {
  expect(qualityGateRunner.runTovyrQualityGates).toBeTypeOf('function')
  if (typeof qualityGateRunner.runTovyrQualityGates !== 'function') return

  const calls = []
  const status = qualityGateRunner.runTovyrQualityGates((...args) => {
    calls.push(args)
    return { status: 0 }
  })

  expect(status).toBe(0)
  expect(calls.map(([file, args]) => [file, args])).toEqual([
    ['bun', ['run', 'test']],
    ['bun', ['run', 'typecheck:tovyr']],
    ['bun', ['run', 'check:dead-ui']],
    ['bun', ['run', 'check:brand']],
  ])
  expect(calls.every(([, , options]) => !('shell' in options))).toBe(true)
  expect(calls.every(([, , options]) => options.stdio === 'inherit')).toBe(true)
})

test('quality runner returns the first child failure status', () => {
  expect(qualityGateRunner.runTovyrQualityGates).toBeTypeOf('function')
  if (typeof qualityGateRunner.runTovyrQualityGates !== 'function') return

  let calls = 0
  const status = qualityGateRunner.runTovyrQualityGates(() => {
    calls += 1
    return { status: calls === 2 ? 23 : 0 }
  })

  expect(status).toBe(23)
  expect(calls).toBe(2)
})

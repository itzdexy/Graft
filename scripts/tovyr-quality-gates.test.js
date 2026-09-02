import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import pkg from '../package.json'

// No mock.module('node:child_process') here, deliberately.
//
// Bun's module mocks are process-wide and have no teardown, so the stub that
// used to live here ("spawnSync: () => ({ status: 0 })") replaced spawnSync
// for every test file that ran afterwards in the same process. Two suites
// downstream then failed in ways that looked like flakes and passed in
// isolation: the invocation-directory contract saw status 0 where it asserts
// the entrypoint fails closed with 1, and loadGitDiffSectionSync got an empty
// stdout and concluded it was not in a git repository.
//
// It was never needed: runTovyrQualityGates() takes the spawn function as a
// parameter, which is how the tests below drive it.
const qualityGateRunner = await import('./tovyr-quality-gates.js')

const config = JSON.parse(
  readFileSync(new URL('../tsconfig.tovyr.json', import.meta.url), 'utf8'),
)

const TOVYR_CORE_FILES = [
  'src/utils/tovyrRuntime.ts',
  'src/services/tovyr/agent/mainLoopLimits.ts',
  'src/services/tovyr/providerErrors.ts',
  'src/services/tovyr/intent/filenameFromPrompt.ts',
  'src/services/tovyr/dx/waitStateCopy.ts',
  'src/services/tovyr/dx/thinkingDurations.ts',
  'src/services/tovyr/dx/requestTimeout.ts',
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
    ['bun', ['run', 'typecheck']],
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

import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTovyrPackageRoot } from './tovyr-package-root.js'
import {
  createTovyrTestHome,
  realHomePath,
  snapshotPath,
} from './tovyr-test-home.js'
import { shouldSkipHomeDirectoryCheck } from './tovyr-launch-hints.js'

const root = getTovyrPackageRoot()
const script = join(root, 'scripts', 'tovyr-provider-cli.js')

function runProviderCli(args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

describe('tovyr provider catalog', () => {
  test('list is deterministic in an isolated home', () => {
    const testHome = createTovyrTestHome()
    try {
      const result = runProviderCli(['list'], testHome.env)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('ollama')
      expect(result.stdout).toContain('freemodel')
      expect(result.stdout).toContain('openrouter')
      expect(result.stdout).not.toContain('[object Object]')
    } finally {
      testHome.cleanup()
    }
  })
})

describe('shouldSkipHomeDirectoryCheck', () => {
  test('skips home guard for ask and print mode', () => {
    expect(shouldSkipHomeDirectoryCheck(['ask', 'hello'])).toBe(true)
    expect(shouldSkipHomeDirectoryCheck(['-p', 'hello'])).toBe(true)
    expect(shouldSkipHomeDirectoryCheck(['config'])).toBe(true)
    expect(shouldSkipHomeDirectoryCheck([])).toBe(false)
  })
})

describe('tovyr provider cli integration', () => {
  test('fixture commands use only the disposable HOME and preserve real-home state', () => {
    const sentinelPath = realHomePath('.tovyr', 'providers.json')
    const before = snapshotPath(sentinelPath)
    const testHome = createTovyrTestHome()
    try {
      expect(testHome.home).not.toBe(realHomePath())
      expect(runProviderCli(['use', 'ollama'], testHome.env).status).toBe(0)
      expect(snapshotPath(sentinelPath)).toEqual(before)
    } finally {
      testHome.cleanup()
    }
  })

  test('provider use without a fixture key exits 1 without switching', () => {
    const testHome = createTovyrTestHome()
    try {
      const result = runProviderCli(['use', 'cerebras'], testHome.env)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('No API key saved')

      const listed = runProviderCli(['list', '--json'], testHome.env)
      expect(JSON.parse(listed.stdout).data.active).toBe('ollama')
    } finally {
      testHome.cleanup()
    }
  })

  test('invalid model on fixture-key FreeModel exits 1 with guidance', () => {
    const testHome = createTovyrTestHome()
    try {
      mkdirSync(join(testHome.home, '.tovyr'), { recursive: true })
      writeFileSync(join(testHome.home, '.tovyr', 'providers.json'), JSON.stringify({
        active: 'ollama',
        keys: { freemodel: 'fe_oa_fixture-key-1234567890' },
        models: {},
        auth: {},
        custom: { baseUrl: '' },
        endpoints: {},
      }))

      const useResult = runProviderCli(['use', 'freemodel'], testHome.env)
      expect(useResult.status).toBe(0)
      const modelResult = runProviderCli(
        ['model', 'not-a-valid-freemodel-id'],
        testHome.env,
      )
      expect(modelResult.status).toBe(1)
      expect(modelResult.stderr).toContain('not supported')
    } finally {
      testHome.cleanup()
    }
  })
})

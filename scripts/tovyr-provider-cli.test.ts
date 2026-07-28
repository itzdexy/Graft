import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  getProvider,
  getActiveProviderId,
  getProviderApiKey,
  isValidKey,
  listProviderCategoriesOrdered,
} from './tovyr-providers.js'
import { formatProviderListLines } from './tovyr-provider-cli.js'
import { shouldSkipHomeDirectoryCheck } from './tovyr-launch-hints.js'
import { getTovyrPackageRoot } from './tovyr-package-root.js'

const root = getTovyrPackageRoot()

describe('tovyr provider catalog', () => {
  test('active provider is optional and resolves when selected', () => {
    const id = getActiveProviderId()
    const provider = getProvider(id)
    if (!id) {
      expect(provider).toBeNull()
    } else {
      expect(provider?.id).toBe(id)
      expect(Array.isArray(provider?.models)).toBe(true)
    }
  })

  test('freemodel provider has default model', () => {
    const provider = getProvider('freemodel')
    expect(provider?.defaultModel || provider?.models?.[0]?.id).toBeTruthy()
  })

  test('uses neutral provider groups and features OpenRouter', () => {
    const groups = listProviderCategoriesOrdered()
    expect(groups.some(group => group.label === 'Official')).toBe(false)
    expect(groups.find(group => group.id === 'direct')?.label).toBe('Model APIs')
    expect(groups.find(group => group.id === 'gateway')?.providers[0]?.id).toBe(
      'openrouter',
    )
    expect(getProvider('fireworks')?.baseUrl).toContain('fireworks.ai')
    expect(getProvider('aimlapi')?.apiFormat).toBe('openai')
    expect(getProvider('siliconflow')?.apiFormat).toBe('openai')
  })
})

describe('formatProviderListLines', () => {
  test('includes known providers with ids and labels', () => {
    const lines = formatProviderListLines('freemodel')
    const text = lines.join('\n')
    expect(text).toContain('freemodel')
    expect(text).toContain('FreeModel')
    expect(text).toContain('openrouter')
    expect(text).not.toContain('[object Object]')
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
  test('provider list prints freemodel entry', () => {
    const script = join(root, 'scripts', 'tovyr-provider-cli.js')
    const result = spawnSync(process.execPath, [script, 'list'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('freemodel')
    expect(result.stdout).toContain('FreeModel')
  })

  test('provider use without a saved key exits 1 without switching', () => {
    const script = join(root, 'scripts', 'tovyr-provider-cli.js')
    const before = getActiveProviderId()
    const result = spawnSync(process.execPath, [script, 'use', 'cerebras'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No API key saved')
    expect(getActiveProviderId()).toBe(before)
  })

  test('invalid model on freemodel exits 1 with guidance', () => {
    const script = join(root, 'scripts', 'tovyr-provider-cli.js')
    const freemodel = getProvider('freemodel')
    const hasKey = freemodel && isValidKey(freemodel, getProviderApiKey('freemodel'))
    if (!hasKey) return

    const useResult = spawnSync(process.execPath, [script, 'use', 'freemodel'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(useResult.status).toBe(0)

    const modelResult = spawnSync(
      process.execPath,
      [script, 'model', 'not-a-valid-freemodel-id'],
      { cwd: root, encoding: 'utf8' },
    )
    expect(modelResult.status).toBe(1)
    expect(modelResult.stderr).toContain('not supported')
  })
})

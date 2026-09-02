import { describe, expect, test } from 'bun:test'
import {
  findTovyrFailoverPlan,
  findTovyrSameProviderVerifiedPlan,
  formatTovyrFailoverNotice,
  formatTovyrModelUnavailableMessage,
  formatTovyrNoApiKeyHelp,
  isModelProviderMismatch,
  isModelUnavailableErrorText,
  isTovyrAutoFailoverEnabled,
  shouldAttemptSameProviderModelRecovery,
} from './providerFailover.js'
import { resetProviderModelCache } from './providerModels.js'
import { pickBestVerifiedModel } from './providerModelPick.js'
import { resolveActive } from '../../../scripts/tovyr-providers.js'
import { getTovyrPackageRoot } from '../../../scripts/tovyr-package-root.js'

describe('providerFailover', () => {
  test('detects Tovyr models on third-party providers', () => {
    expect(
      isModelProviderMismatch('claude-haiku-4-5-20251001', 'nvidia_nim'),
    ).toBe(true)
    expect(
      isModelProviderMismatch('meta/llama-3.1-70b-instruct', 'nvidia_nim'),
    ).toBe(false)
  })

  test('detects model-unavailable error text', () => {
    expect(
      isModelUnavailableErrorText(
        'The model claude-haiku is not available on your firstParty deployment.',
      ),
    ).toBe(true)
    expect(
      isModelUnavailableErrorText(
        'The model "meta-llama/llama-3.1-405b-instruct" is not available on OpenRouter.',
      ),
    ).toBe(true)
    expect(isModelUnavailableErrorText('Rate limit exceeded')).toBe(false)
    expect(isModelUnavailableErrorText('You exceeded your current quota')).toBe(false)
  })

  test('same-provider recovery covers idle timeout and empty stream', async () => {
    const { shouldAttemptSameProviderModelRecovery } = await import(
      './providerFailover.js'
    )
    expect(
      shouldAttemptSameProviderModelRecovery(
        'The model codellama is not available',
      ),
    ).toBe(true)
    expect(
      shouldAttemptSameProviderModelRecovery(
        'Stream timed out after 120s with no model output',
      ),
    ).toBe(true)
    expect(
      shouldAttemptSameProviderModelRecovery(
        'Provider returned an empty stream',
      ),
    ).toBe(true)
    expect(
      shouldAttemptSameProviderModelRecovery('Rate limit exceeded'),
    ).toBe(false)
    expect(
      shouldAttemptSameProviderModelRecovery(
        'Usage credits are required for this model',
      ),
    ).toBe(false)
  })

  test('shouldFailoverForAssistantError skips rate limits', async () => {
    const { shouldFailoverForAssistantError } = await import('./providerFailover.js')
    expect(shouldFailoverForAssistantError('Model foo not found')).toBe(true)
    expect(shouldFailoverForAssistantError('Rate limit exceeded, try again')).toBe(false)
  })

  test('includes setup instructions in no-key help', () => {
    const help = formatTovyrNoApiKeyHelp()
    expect(help).toContain('/provider')
    expect(help).toContain('~/.tovyr/providers.json')
  })

  test('formatTovyrFailoverNotice is actionable', () => {
    const msg = formatTovyrFailoverNotice({
      providerId: 'openrouter',
      providerLabel: 'OpenRouter',
      model: 'anthropic/claude-sonnet-4',
      reason: 'alternate provider after model failed',
    })
    expect(msg).toContain('OpenRouter')
    expect(msg).toContain('anthropic/claude-sonnet-4')
    expect(msg).toContain('/model')
  })

  test('formatTovyrModelUnavailableMessage suggests verified fallback', () => {
    if (!resolveActive()) {
      const msg = formatTovyrModelUnavailableMessage('databricks/dbrx-instruct')
      expect(msg).toContain('No API key')
      return
    }

    const prevRoot = process.env.TOVYR_PACKAGE_ROOT
    process.env.TOVYR_PACKAGE_ROOT = getTovyrPackageRoot()
    resetProviderModelCache()
    try {
      const msg = formatTovyrModelUnavailableMessage('databricks/dbrx-instruct')
      expect(msg).toContain('databricks/dbrx-instruct')
      expect(msg).toContain('/model')
    } finally {
      resetProviderModelCache()
      if (prevRoot === undefined) delete process.env.TOVYR_PACKAGE_ROOT
      else process.env.TOVYR_PACKAGE_ROOT = prevRoot
    }
  })

  test('pickBestVerifiedModel prefers provider default over API list order', () => {
    const pick = pickBestVerifiedModel('nvidia_nim', [
      'deepseek-ai/deepseek-v3',
      'databricks/dbrx-instruct',
      'meta/llama-3.1-70b-instruct',
    ])
    expect(pick).toBe('meta/llama-3.1-70b-instruct')
  })

  test('pickBestVerifiedModel skips excluded models', () => {
    const pick = pickBestVerifiedModel(
      'nvidia_nim',
      ['deepseek-ai/deepseek-v3', 'meta/llama-3.1-70b-instruct'],
      new Set(['meta/llama-3.1-70b-instruct']),
    )
    expect(pick).toBe('deepseek-ai/deepseek-v3')
  })

  test('auto-failover is off by default', () => {
    const prev = process.env.TOVYR_AUTO_FAILOVER
    delete process.env.TOVYR_AUTO_FAILOVER
    try {
      expect(isTovyrAutoFailoverEnabled()).toBe(false)
      expect(
        findTovyrFailoverPlan('meta/llama-3.1-70b-instruct', [], []),
      ).toBeNull()
    } finally {
      if (prev === undefined) delete process.env.TOVYR_AUTO_FAILOVER
      else process.env.TOVYR_AUTO_FAILOVER = prev
    }
  })

  test('same-provider verified recovery is null with a cold cache and never consults auto-failover', () => {
    // With no /v1/models cache there is no verified alternative, so the plan is
    // null — but it must reach that conclusion safely (no throw) and WITHOUT
    // requiring TOVYR_AUTO_FAILOVER, unlike findTovyrFailoverPlan. This is the
    // recovery path that rescues users stuck re-hitting the same model 404.
    const prevRoot = process.env.TOVYR_PACKAGE_ROOT
    const prevFailover = process.env.TOVYR_AUTO_FAILOVER
    process.env.TOVYR_PACKAGE_ROOT = '1'
    delete process.env.TOVYR_AUTO_FAILOVER
    resetProviderModelCache()
    try {
      expect(isTovyrAutoFailoverEnabled()).toBe(false)
      expect(
        findTovyrSameProviderVerifiedPlan('meta/codellama-70b', []),
      ).toBeNull()
    } finally {
      resetProviderModelCache()
      if (prevRoot === undefined) delete process.env.TOVYR_PACKAGE_ROOT
      else process.env.TOVYR_PACKAGE_ROOT = prevRoot
      if (prevFailover === undefined) delete process.env.TOVYR_AUTO_FAILOVER
      else process.env.TOVYR_AUTO_FAILOVER = prevFailover
    }
  })

  test('findTovyrFailoverPlan skips already-tried models on same provider', () => {
    const prev = process.env.TOVYR_PACKAGE_ROOT
    process.env.TOVYR_PACKAGE_ROOT = '1'
    try {
      const plan = findTovyrFailoverPlan(
        'meta/llama-3.1-70b-instruct',
        [],
        ['meta/llama-3.1-70b-instruct', 'deepseek-ai/deepseek-v3'],
      )
      if (plan && plan.providerId === 'nvidia_nim') {
        expect(plan.model).not.toBe('meta/llama-3.1-70b-instruct')
        expect(plan.model).not.toBe('deepseek-ai/deepseek-v3')
      }
    } finally {
      if (prev === undefined) delete process.env.TOVYR_PACKAGE_ROOT
      else process.env.TOVYR_PACKAGE_ROOT = prev
    }
  })
})

describe('slow is not broken', () => {
  test('a stream timeout never triggers a model swap', () => {
    // A reasoning model that thought past the budget used to be replaced
    // mid-session by whatever else happened to be verified.
    expect(
      shouldAttemptSameProviderModelRecovery(
        'Model stream timed out after 45s with no response.',
      ),
    ).toBe(false)
    expect(
      shouldAttemptSameProviderModelRecovery('Request timed out after 30s'),
    ).toBe(false)
  })

  test('genuinely empty output still counts as a broken model', () => {
    expect(
      shouldAttemptSameProviderModelRecovery('Provider returned an empty stream'),
    ).toBe(true)
    expect(
      shouldAttemptSameProviderModelRecovery('returned no model output'),
    ).toBe(true)
  })

  test('rate limits and quota are still not model problems', () => {
    expect(
      shouldAttemptSameProviderModelRecovery('429 rate limit exceeded'),
    ).toBe(false)
  })
})

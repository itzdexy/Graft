import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getActiveProviderId,
  resolveActive,
} from '../../scripts/tovyr-providers.js'
import { getTovyrPackageRoot } from '../../scripts/tovyr-package-root.js'

const emptyState = {
  active: '',
  keys: {},
  models: {},
  auth: {},
  custom: { baseUrl: '' },
  endpoints: {},
}

describe('Tovyr free local mode', () => {
  test('fresh installs resolve to accountless Ollama', () => {
    expect(getActiveProviderId(emptyState)).toBe('ollama')
    expect(resolveActive(emptyState)).toMatchObject({
      providerId: 'ollama',
      apiKey: 'local-only',
      model: 'qwen2.5-coder:1.5b',
      authMode: 'apiKey',
    })
  })

  test('Tovyr suppresses the foreign login warning', () => {
    const root = getTovyrPackageRoot()
    const notifications = readFileSync(
      join(root, 'components', 'PromptInput', 'Notifications.tsx'),
      'utf8',
    )
    expect(notifications).toContain(
      "!isTovyrRuntime() &&\n        (apiKeyStatus === 'invalid'",
    )
  })

  test('first-run onboarding does not force provider login', () => {
    const root = getTovyrPackageRoot()
    const onboarding = readFileSync(
      join(root, 'components', 'Onboarding.tsx'),
      'utf8',
    )
    expect(onboarding).toContain('Free local mode is on')
    expect(onboarding).not.toContain('<ProviderFlow')
  })
})

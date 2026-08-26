/**
 * Tovyr Provider System
 *
 * Manages multi-provider authentication and configuration for Tovyr.
 * Supports 20+ Tovyr-compatible providers including FreeModel, OpenRouter,
 * OpenAI, DeepSeek, Gemini, and custom OpenAI-compatible APIs.
 *
 * Provider keys are stored in ~/.tovyr/ (never in git or npm packages).
 * The default provider is FreeModel (https://cc.freemodel.dev).
 *
 * @module services/tovyr/provider
 */

import {
  TOVYR_PROVIDER_BASE_URL,
  TOVYR_PROVIDER_NAME,
} from '../../constants/tovyr.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getTovyrHome } from '../../scripts/tovyr-home.js'
import {
  getProvider,
  isValidKey,
  resolveActive,
  setActiveProvider,
  setProviderKey,
} from '../../scripts/tovyr-providers.js'
import { persistActiveProvider } from '../../scripts/tovyr-prep-auth.js'
import {
  getAnthropicApiKeyWithSource,
  getApiKeyFromConfigOrMacOSKeychain,
  getTovyrWebOAuthTokens,
  isCustomApiKeyApproved,
  saveApiKey,
} from '../../utils/auth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'
import { verifyApiKey } from '../api/claude.js'
import { syncTovyrModelToSession } from './syncModelState.js'
import { warmRepoMapCache } from './repo/repoContext.js'
import { applyTovyrActiveProviderToEnv } from './applyProviderEnv.js'
import { scheduleActiveProviderProbe } from './providers/probe.js'
import { getActivePlatformSelection } from './platform/providerRegistry.js'

/** Drop tovyr web OAuth so Tovyr uses only the FreeModel API key. */
export function clearClaudeAiOAuthSession(): void {
  try {
    const secureStorage = getSecureStorage()
    const storageData = secureStorage.read()
    if (storageData?.claudeAiOauth) {
      const { claudeAiOauth: _removed, ...rest } = storageData
      if (Object.keys(rest).length === 0) {
        secureStorage.delete()
      } else {
        secureStorage.update(rest)
      }
    }
  } catch {
    // Best-effort: config cleanup below still removes oauthAccount.
  }

  saveGlobalConfig(current => {
    if (current.oauthAccount === undefined) {
      return current
    }
    return { ...current, oauthAccount: undefined }
  })

  getTovyrWebOAuthTokens.cache?.clear?.()
  getApiKeyFromConfigOrMacOSKeychain.cache.clear?.()
}

export function getTovyrProviderBaseUrl(): string {
  return process.env.TOVYR_PROVIDER_BASE_URL?.trim() || TOVYR_PROVIDER_BASE_URL
}

/** Apply active provider env before API clients initialize. */
export function applyTovyrProviderEnv(): void {
  const isTovyr = !!(process.env.TOVYR_PACKAGE_ROOT || process.env.TOVYR_SRC)

  if (isTovyr) {
    try {
      const active = resolveActive()
      const platformSelection = getActivePlatformSelection()
      if (active && platformSelection && (active.apiKey || active.authMode === 'oauth')) {
        applyTovyrActiveProviderToEnv({
          providerId: platformSelection.providerId,
          baseUrl: platformSelection.baseUrl,
          apiKey: platformSelection.apiKey,
          model: platformSelection.modelId,
          authMode: platformSelection.authMode,
        })
        if (platformSelection.modelId) {
          syncTovyrModelToSession(platformSelection.modelId)
        }
        if (active.authMode !== 'oauth') {
          clearClaudeAiOAuthSession()
        }
        warmRepoMapCache()
        return
      }
    } catch {
      // fall through to legacy active.json path
    }

    const home = getTovyrHome()
    const activePath = join(home, '.tovyr', 'active.json')

    if (existsSync(activePath)) {
      try {
        const active = JSON.parse(readFileSync(activePath, 'utf8')) as {
          provider?: string
          baseUrl?: string
          model?: string
          authMode?: 'apiKey' | 'authToken'
        }
        const keyPath = join(home, '.tovyr', 'api-key')
        const apiKey = existsSync(keyPath)
          ? readFileSync(keyPath, 'utf8').trim()
          : ''

        if (active.baseUrl && apiKey && active.provider) {
          applyTovyrActiveProviderToEnv({
            providerId: active.provider,
            baseUrl: active.baseUrl,
            apiKey,
            model: active.model,
            authMode: active.authMode,
          })
        } else {
          if (active.baseUrl) {
            process.env.ANTHROPIC_BASE_URL = active.baseUrl
          }
          if (active.model) {
            process.env.ANTHROPIC_MODEL = active.model
          }
          if (apiKey) {
            if (active.authMode === 'authToken') {
              process.env.ANTHROPIC_AUTH_TOKEN = apiKey
              process.env.ANTHROPIC_API_KEY = ''
            } else {
              process.env.ANTHROPIC_API_KEY = apiKey
              delete process.env.ANTHROPIC_AUTH_TOKEN
            }
          }
        }
        if (active.model) {
          syncTovyrModelToSession(active.model)
        }
        clearClaudeAiOAuthSession()
        warmRepoMapCache()
        return
      } catch {
        // fall through to legacy FreeModel path
      }
    }
  }

  const config = getGlobalConfig()
  const apiKeyRecord = getApiKeyFromConfigOrMacOSKeychain()
  const usesTovyr =
    !!config.tovyrProvider ||
    !!apiKeyRecord?.key?.startsWith('fe_oa_') ||
    !!process.env.TOVYR_API_KEY?.trim()

  if (usesTovyr) {
    if (!process.env.ANTHROPIC_BASE_URL) {
      process.env.ANTHROPIC_BASE_URL = getTovyrProviderBaseUrl()
    }
    clearClaudeAiOAuthSession()
  }

  const envKey = process.env.TOVYR_API_KEY?.trim()
  const storedKey = apiKeyRecord?.key?.trim()
  const key = envKey || storedKey

  if (usesTovyr && key?.startsWith('fe_oa_')) {
    if (isCustomApiKeyApproved(key)) {
      process.env.ANTHROPIC_API_KEY = key
    }
  } else if (envKey) {
    process.env.ANTHROPIC_API_KEY = envKey
  }
}

export function isTovyrApiKeyFormat(apiKey: string): boolean {
  return /^fe_oa_[a-zA-Z0-9]+$/.test(apiKey.trim())
}

/** Connect any catalog provider selected by the user. */
export async function loginWithProviderApiKey(
  providerId: string,
  apiKey: string,
): Promise<void> {
  const provider = getProvider(providerId)
  const trimmed = apiKey.trim()
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`)
  }
  if (!isValidKey(provider, trimmed)) {
    throw new Error(
      `Invalid ${provider.label} API key. Expected ${provider.keyHint || 'a valid key'}.`,
    )
  }

  setProviderKey(providerId, trimmed)
  setActiveProvider(providerId)
  const active = persistActiveProvider()
  if (!active) {
    throw new Error(`Could not activate ${provider.label}.`)
  }
  applyTovyrActiveProviderToEnv(active)
  syncTovyrModelToSession(active.model)
  saveGlobalConfig(current => ({
    ...current,
    hasCompletedOnboarding: true,
  }))
  logForDebugging(`Tovyr: connected to ${provider.label}`, { level: 'info' })
  scheduleActiveProviderProbe({ force: true })
}

export async function loginWithTovyrApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Error('API key is required')
  }

  if (!isTovyrApiKeyFormat(trimmed)) {
    throw new Error(
      `Invalid ${TOVYR_PROVIDER_NAME} API key. Keys start with fe_oa_.`,
    )
  }

  process.env.ANTHROPIC_BASE_URL = getTovyrProviderBaseUrl()
  process.env.ANTHROPIC_API_KEY = trimmed

  const isValid = await verifyApiKey(trimmed, false)
  if (!isValid) {
    throw new Error(
      `Could not verify API key with ${TOVYR_PROVIDER_NAME}. Check the key and try again.`,
    )
  }

  await saveApiKey(trimmed)
  getApiKeyFromConfigOrMacOSKeychain.cache.clear?.()

  clearClaudeAiOAuthSession()
  delete process.env.ANTHROPIC_API_KEY

  const tovyrDir = join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.tovyr',
  )
  mkdirSync(tovyrDir, { recursive: true })
  writeFileSync(join(tovyrDir, 'api-key'), trimmed, { mode: 0o600 })

  saveGlobalConfig(current => ({
    ...current,
    hasCompletedOnboarding: true,
    tovyrProvider: {
      name: TOVYR_PROVIDER_NAME,
      baseUrl: getTovyrProviderBaseUrl(),
      connectedAt: Date.now(),
    },
  }))

  logForDebugging(`Tovyr: connected to ${TOVYR_PROVIDER_NAME}`, {
    level: 'info',
  })
}

export function getTovyrConnectionSummary(): string | null {
  const config = getGlobalConfig()
  if (!config.tovyrProvider && !getAnthropicApiKeyWithSource().key) {
    return null
  }
  const provider = config.tovyrProvider?.name ?? TOVYR_PROVIDER_NAME
  const baseUrl = config.tovyrProvider?.baseUrl ?? getTovyrProviderBaseUrl()
  return `${provider} (${baseUrl})`
}

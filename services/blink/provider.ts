/**
 * Blink Provider System
 *
 * Manages multi-provider authentication and configuration for Blink.
 * Supports 20+ Blink-compatible providers including FreeModel, OpenRouter,
 * OpenAI, DeepSeek, Gemini, and custom OpenAI-compatible APIs.
 *
 * Provider keys are stored in ~/.blink/ (never in git or npm packages).
 * The default provider is FreeModel (https://cc.freemodel.dev).
 *
 * @module services/blink/provider
 */

import {
  BLINK_PROVIDER_BASE_URL,
  BLINK_PROVIDER_NAME,
} from '../../constants/blink.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getBlinkHome } from '../../scripts/blink-home.js'
import {
  getProvider,
  isValidKey,
  resolveActive,
  setActiveProvider,
  setProviderKey,
} from '../../scripts/blink-providers.js'
import { persistActiveProvider } from '../../scripts/blink-prep-auth.js'
import {
  getAnthropicApiKeyWithSource,
  getApiKeyFromConfigOrMacOSKeychain,
  getBlinkWebOAuthTokens,
  saveApiKey,
} from '../../utils/auth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'
import { verifyApiKey } from '../api/claude.js'
import { syncBlinkModelToSession } from './syncModelState.js'
import { warmRepoMapCache } from './repo/repoContext.js'
import { applyBlinkActiveProviderToEnv } from './applyProviderEnv.js'

/** Drop blink web OAuth so Blink uses only the FreeModel API key. */
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

  getBlinkWebOAuthTokens.cache?.clear?.()
  getApiKeyFromConfigOrMacOSKeychain.cache.clear?.()
}

export function getBlinkProviderBaseUrl(): string {
  return process.env.BLINK_PROVIDER_BASE_URL?.trim() || BLINK_PROVIDER_BASE_URL
}

/** Apply active provider env before API clients initialize. */
export function applyBlinkProviderEnv(): void {
  const isBlink = !!(process.env.BLINK_PACKAGE_ROOT || process.env.BLINK_SRC)

  if (isBlink) {
    try {
      const active = resolveActive()
      if (active?.apiKey) {
        applyBlinkActiveProviderToEnv({
          providerId: active.providerId,
          baseUrl: active.baseUrl,
          apiKey: active.apiKey,
          model: active.model,
          authMode: active.authMode,
        })
        if (active.model) {
          syncBlinkModelToSession(active.model)
        }
        clearClaudeAiOAuthSession()
        warmRepoMapCache()
        return
      }
    } catch {
      // fall through to legacy active.json path
    }

    const home = getBlinkHome()
    const activePath = join(home, '.blink', 'active.json')

    if (existsSync(activePath)) {
      try {
        const active = JSON.parse(readFileSync(activePath, 'utf8')) as {
          provider?: string
          baseUrl?: string
          model?: string
          authMode?: 'apiKey' | 'authToken'
        }
        const keyPath = join(home, '.blink', 'api-key')
        const apiKey = existsSync(keyPath)
          ? readFileSync(keyPath, 'utf8').trim()
          : ''

        if (active.baseUrl && apiKey && active.provider) {
          applyBlinkActiveProviderToEnv({
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
          syncBlinkModelToSession(active.model)
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
  const usesBlink =
    !!config.blinkProvider ||
    !!config.primaryApiKey?.startsWith('fe_oa_') ||
    !!process.env.BLINK_API_KEY?.trim()

  if (usesBlink) {
    if (!process.env.ANTHROPIC_BASE_URL) {
      process.env.ANTHROPIC_BASE_URL = getBlinkProviderBaseUrl()
    }
    clearClaudeAiOAuthSession()
  }

  const envKey = process.env.BLINK_API_KEY?.trim()
  const configKey = config.primaryApiKey?.trim()
  const key = envKey || configKey

  if (usesBlink && key?.startsWith('fe_oa_')) {
    const approved = config.customApiKeyResponses?.approved ?? []
    const normalized = key.slice(-20)
    if (approved.includes(normalized)) {
      process.env.ANTHROPIC_API_KEY = key
    }
  } else if (envKey) {
    process.env.ANTHROPIC_API_KEY = envKey
  }
}

export function isBlinkApiKeyFormat(apiKey: string): boolean {
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
  applyBlinkActiveProviderToEnv(active)
  syncBlinkModelToSession(active.model)
  saveGlobalConfig(current => ({
    ...current,
    hasCompletedOnboarding: true,
  }))
  logForDebugging(`Blink: connected to ${provider.label}`, { level: 'info' })
}

export async function loginWithBlinkApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Error('API key is required')
  }

  if (!isBlinkApiKeyFormat(trimmed)) {
    throw new Error(
      `Invalid ${BLINK_PROVIDER_NAME} API key. Keys start with fe_oa_.`,
    )
  }

  process.env.ANTHROPIC_BASE_URL = getBlinkProviderBaseUrl()
  process.env.ANTHROPIC_API_KEY = trimmed

  const isValid = await verifyApiKey(trimmed, false)
  if (!isValid) {
    throw new Error(
      `Could not verify API key with ${BLINK_PROVIDER_NAME}. Check the key and try again.`,
    )
  }

  await saveApiKey(trimmed)
  getApiKeyFromConfigOrMacOSKeychain.cache.clear?.()

  clearClaudeAiOAuthSession()
  delete process.env.ANTHROPIC_API_KEY

  const blinkDir = join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.blink',
  )
  mkdirSync(blinkDir, { recursive: true })
  writeFileSync(join(blinkDir, 'api-key'), trimmed, { mode: 0o600 })

  saveGlobalConfig(current => ({
    ...current,
    hasCompletedOnboarding: true,
    blinkProvider: {
      name: BLINK_PROVIDER_NAME,
      baseUrl: getBlinkProviderBaseUrl(),
      connectedAt: Date.now(),
    },
  }))

  logForDebugging(`Blink: connected to ${BLINK_PROVIDER_NAME}`, {
    level: 'info',
  })
}

export function getBlinkConnectionSummary(): string | null {
  const config = getGlobalConfig()
  if (!config.blinkProvider && !getAnthropicApiKeyWithSource().key) {
    return null
  }
  const provider = config.blinkProvider?.name ?? BLINK_PROVIDER_NAME
  const baseUrl = config.blinkProvider?.baseUrl ?? getBlinkProviderBaseUrl()
  return `${provider} (${baseUrl})`
}

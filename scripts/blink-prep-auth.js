/**
 * Prepare Blink auth: FreeModel API key only, no legacy web OAuth.
 * Prints the API key on stdout when run directly.
 */
import {
  writeFileSync,
  unlinkSync,
  existsSync,
  mkdirSync,
} from 'fs'
import { join } from 'path'
import {
  syncProviderSettings,
} from './blink-sync-freemodel-settings.js'
import { applyBlinkSettingsTune } from './blink-tune-settings.js'
import {
  applyBlinkProviderCompatToProcess,
  getBlinkProviderCompatEnv,
} from './blink-model-compat.js'
import {
  resolveActive,
  getProvider,
  getActiveProviderId,
} from './blink-providers.js'

import { getBlinkHome } from './blink-home.js'
import { readJsonSafe, writeJsonAtomic } from './blink-safe-json.js'

const home = getBlinkHome()
const configPath = join(home, '.claude.json')
const credPath = join(home, '.claude', '.credentials.json')
const blinkKeyPath = join(home, '.blink', 'api-key')
const activePath = join(home, '.blink', 'active.json')

function normalizeApiKeyForConfig(apiKey) {
  return apiKey.slice(-20)
}

function loadConfig() {
  return readJsonSafe(configPath, {})
}

function saveConfig(config) {
  writeJsonAtomic(configPath, config)
}

function clearClaudeAiOAuth(config) {
  if (config.oauthAccount !== undefined) {
    delete config.oauthAccount
  }

  if (existsSync(credPath)) {
    const cred = readJsonSafe(credPath, null)
    if (cred && cred.claudeAiOauth) {
      delete cred.claudeAiOauth
      if (Object.keys(cred).length === 0) {
        unlinkSync(credPath)
      } else {
        writeJsonAtomic(credPath, cred)
      }
    }
  }
}

function ensureApiKeyApproved(config, active) {
  const normalized = normalizeApiKeyForConfig(active.apiKey)
  if (!config.customApiKeyResponses) {
    config.customApiKeyResponses = { approved: [], rejected: [] }
  }
  if (!config.customApiKeyResponses.approved.includes(normalized)) {
    config.customApiKeyResponses.approved.push(normalized)
  }
  config.primaryApiKey = active.apiKey
  config.hasCompletedOnboarding = true
  config.blinkProvider = {
    id: active.providerId,
    name: active.label,
    baseUrl: active.baseUrl,
    model: active.model,
    connectedAt: Date.now(),
  }
}

/**
 * Env vars the Bun child needs. Exactly one credential shape per provider:
 * apiKey → ANTHROPIC_API_KEY only; authToken → ANTHROPIC_AUTH_TOKEN only.
 */
export function buildBlinkChildAuthEnv() {
  const active = resolveActive()
  if (!active) {
    return {
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_AUTH_TOKEN: '',
    }
  }

  const compat = getBlinkProviderCompatEnv(active.providerId, active.model || '')
  const base = {
    ANTHROPIC_BASE_URL: active.baseUrl,
    ...(active.model ? { ANTHROPIC_MODEL: active.model } : {}),
    ...compat,
  }

  if (active.authMode === 'authToken') {
    return {
      ...base,
      ANTHROPIC_AUTH_TOKEN: active.apiKey,
      ANTHROPIC_API_KEY: '',
    }
  }

  return {
    ...base,
    ANTHROPIC_API_KEY: active.apiKey,
    ANTHROPIC_AUTH_TOKEN: '',
  }
}

function noKeyMessage() {
  const providerId = getActiveProviderId()
  const provider = getProvider(providerId)
  const hint = provider?.keyHint || 'API key'
  const signup = provider?.signup ? `\nGet a key: ${provider.signup}` : ''
  return (
    `No valid API key for provider "${provider?.label || providerId}".\n\n` +
    `  blink auth login --key ${hint}\n` +
    `  (switch providers in-app with /provider)${signup}\n`
  )
}

/** Persist active provider to disk (config, settings, ~/.blink/*). Returns active or null. */
export function persistActiveProvider(config = loadConfig()) {
  clearClaudeAiOAuth(config)

  const active = resolveActive()
  if (!active) {
    return null
  }

  ensureApiKeyApproved(config, active)

  const blinkDir = join(home, '.blink')
  if (!existsSync(blinkDir)) {
    mkdirSync(blinkDir, { recursive: true })
  }
  writeFileSync(blinkKeyPath, active.apiKey, { mode: 0o600 })
  writeJsonAtomic(activePath, {
    provider: active.providerId,
    label: active.label,
    baseUrl: active.baseUrl,
    model: active.model,
    authMode: active.authMode,
  })

  syncProviderSettings(active.apiKey, {
    baseUrl: active.baseUrl,
    model: active.model,
    authMode: active.authMode,
    providerId: active.providerId,
  })
  applyBlinkSettingsTune()
  ensureBlinkBuddy(config)
  saveConfig(config)

  return active
}

/**
 * Persist active provider to disk and sync model-compat env vars.
 * Bun callers must also invoke applyBlinkActiveProviderToEnv (proxy routing).
 */
export function applyActiveProviderToProcess() {
  const active = persistActiveProvider()
  if (!active) {
    throw new Error('No valid API key for the active provider. Use /provider key <key>.')
  }

  applyBlinkProviderCompatToProcess(active.providerId, active.model || '')

  return active
}

export function prepareBlinkAuth() {
  const active = persistActiveProvider()
  if (!active) {
    console.error(noKeyMessage())
    process.exit(1)
  }
  return active.apiKey
}

function ensureBlinkBuddy(config) {
  config.companion = {
    name: 'Blink Buddy',
    personality:
      'Proactive senior engineer: architect, debugger, reviewer, and project manager. Suggests improvements, tracks goals, explains reasoning, and never makes destructive changes without approval.',
    hatchedAt: config.companion?.hatchedAt ?? Date.now(),
  }
  config.companionMuted = false
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('blink-prep-auth.js') ||
    process.argv[1].endsWith('blink-prep-auth.mjs'))

if (isMain) {
  prepareBlinkAuth()
  process.stdout.write('ready\n')
}

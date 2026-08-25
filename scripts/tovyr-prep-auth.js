/**
 * Prepare Tovyr auth: FreeModel API key only, no legacy web OAuth.
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
} from './tovyr-sync-freemodel-settings.js'
import { applyTovyrSettingsTune } from './tovyr-tune-settings.js'
import {
  applyTovyrProviderCompatToProcess,
  getTovyrProviderCompatEnv,
} from './tovyr-model-compat.js'
import {
  resolveActive,
  getProvider,
  getActiveProviderId,
} from './tovyr-providers.js'
import { LOCAL_PROVIDER_PLACEHOLDER_KEY } from './tovyr-provider-local.js'

import { getTovyrHome } from './tovyr-home.js'
import { readJsonSafe, writeJsonAtomic } from './tovyr-safe-json.js'

const home = getTovyrHome()
const configPath = join(home, '.tovyr.json')
const credPath = join(home, '.tovyr', '.credentials.json')
const tovyrKeyPath = join(home, '.tovyr', 'api-key')
const activePath = join(home, '.tovyr', 'active.json')

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
  // The actual API key lives in ~/.tovyr/api-key; do not store it in ~/.tovyr.json.
  config.hasCompletedOnboarding = true
  config.tovyrProvider = {
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
export function buildTovyrChildAuthEnv() {
  const active = resolveActive()
  if (!active) {
    return {
      TOVYR_ACTIVE_PROVIDER: '',
      TOVYR_PROVIDER_AUTH_MODE: '',
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_AUTH_TOKEN: '',
    }
  }

  const compat = getTovyrProviderCompatEnv(active.providerId, active.model || '')
  const base = {
    TOVYR_ACTIVE_PROVIDER: active.providerId,
    TOVYR_PROVIDER_AUTH_MODE: active.authMode,
    ANTHROPIC_BASE_URL: active.baseUrl,
    ...(active.model ? { ANTHROPIC_MODEL: active.model } : {}),
    ...compat,
  }

  if (active.authMode === 'oauth') {
    return {
      ...base,
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_AUTH_TOKEN: '',
    }
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
    `  tovyr auth login --key ${hint}\n` +
    `  (switch providers in-app with /provider)${signup}\n`
  )
}

/** Persist active provider to disk (config, settings, ~/.tovyr/*). Returns active or null. */
export function persistActiveProvider(config = loadConfig()) {
  const active = resolveActive()
  if (!active) {
    return null
  }

  if (active.authMode !== 'oauth') {
    clearClaudeAiOAuth(config)
    ensureApiKeyApproved(config, active)
  }

  const tovyrDir = join(home, '.tovyr')
  if (!existsSync(tovyrDir)) {
    mkdirSync(tovyrDir, { recursive: true })
  }
  if (active.authMode !== 'oauth') {
    writeFileSync(tovyrKeyPath, active.apiKey, { mode: 0o600 })
  }
  writeJsonAtomic(activePath, {
    provider: active.providerId,
    label: active.label,
    baseUrl: active.baseUrl,
    model: active.model,
    authMode: active.authMode,
  })

  if (active.authMode !== 'oauth') {
    syncProviderSettings(active.apiKey, {
      baseUrl: active.baseUrl,
      model: active.model,
      authMode: active.authMode,
      providerId: active.providerId,
    })
  }
  applyTovyrSettingsTune()
  ensureTovyrBuddy(config)
  saveConfig(config)

  return active
}

/**
 * Persist active provider to disk and sync model-compat env vars.
 * Bun callers must also invoke applyTovyrActiveProviderToEnv (proxy routing).
 */
export function applyActiveProviderToProcess() {
  const active = persistActiveProvider()
  if (!active) {
    throw new Error('No valid API key for the active provider. Use /provider key <key>.')
  }

  applyTovyrProviderCompatToProcess(active.providerId, active.model || '')

  return active
}

export function prepareTovyrAuth() {
  const active = persistActiveProvider()
  if (!active) {
    console.error(noKeyMessage())
    process.exit(1)
  }
  return active.apiKey
}

function ensureTovyrBuddy(config) {
  config.companion = {
    name: 'Tovyr Buddy',
    personality:
      'Proactive senior engineer: architect, debugger, reviewer, and project manager. Suggests improvements, tracks goals, explains reasoning, and never makes destructive changes without approval.',
    hatchedAt: config.companion?.hatchedAt ?? Date.now(),
  }
  config.companionMuted = false
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('tovyr-prep-auth.js') ||
    process.argv[1].endsWith('tovyr-prep-auth.mjs'))

if (isMain) {
  const key = prepareTovyrAuth()
  if (key === LOCAL_PROVIDER_PLACEHOLDER_KEY) {
    console.error(noKeyMessage())
    process.exit(1)
  }
  process.stdout.write('ready\n')
}

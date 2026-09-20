/**
 * Prepare Graft auth: FreeModel API key only, no legacy web OAuth.
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
} from './graft-sync-freemodel-settings.js'
import { applyGraftSettingsTune } from './graft-tune-settings.js'
import {
  applyGraftProviderCompatToProcess,
  getGraftProviderCompatEnv,
} from './graft-model-compat.js'
import {
  resolveActive,
  getProvider,
  getActiveProviderId,
} from './graft-providers.js'
import { LOCAL_PROVIDER_PLACEHOLDER_KEY } from './graft-provider-local.js'

import { getGraftHome } from './graft-home.js'
import { readJsonSafe, writeJsonAtomic } from './graft-safe-json.js'

const home = getGraftHome()
const configPath = join(home, '.graft.json')
const credPath = join(home, '.graft', '.credentials.json')
const graftKeyPath = join(home, '.graft', 'api-key')
const activePath = join(home, '.graft', 'active.json')

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
  // The actual API key lives in ~/.graft/api-key; do not store it in ~/.graft.json.
  config.hasCompletedOnboarding = true
  config.graftProvider = {
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
export function buildGraftChildAuthEnv() {
  const active = resolveActive()
  if (!active) {
    return {
      GRAFT_ACTIVE_PROVIDER: '',
      GRAFT_PROVIDER_AUTH_MODE: '',
      ANTHROPIC_BASE_URL: '',
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_AUTH_TOKEN: '',
    }
  }

  const compat = getGraftProviderCompatEnv(active.providerId, active.model || '')
  const base = {
    GRAFT_ACTIVE_PROVIDER: active.providerId,
    GRAFT_PROVIDER_AUTH_MODE: active.authMode,
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
    `  graft auth login --key ${hint}\n` +
    `  (switch providers in-app with /provider)${signup}\n`
  )
}

/** Persist active provider to disk (config, settings, ~/.graft/*). Returns active or null. */
export function persistActiveProvider(config = loadConfig()) {
  const active = resolveActive()
  if (!active) {
    return null
  }

  if (active.authMode !== 'oauth') {
    clearClaudeAiOAuth(config)
    ensureApiKeyApproved(config, active)
  }

  const graftDir = join(home, '.graft')
  if (!existsSync(graftDir)) {
    mkdirSync(graftDir, { recursive: true })
  }
  if (active.authMode !== 'oauth') {
    writeFileSync(graftKeyPath, active.apiKey, { mode: 0o600 })
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
  applyGraftSettingsTune()
  ensureGraftBuddy(config)
  saveConfig(config)

  return active
}

/**
 * Persist active provider to disk and sync model-compat env vars.
 * Bun callers must also invoke applyGraftActiveProviderToEnv (proxy routing).
 */
export function applyActiveProviderToProcess() {
  const active = persistActiveProvider()
  if (!active) {
    throw new Error('No valid API key for the active provider. Use /provider key <key>.')
  }

  applyGraftProviderCompatToProcess(active.providerId, active.model || '')

  return active
}

export function prepareGraftAuth() {
  const active = persistActiveProvider()
  if (!active) {
    console.error(noKeyMessage())
    process.exit(1)
  }
  return active.apiKey
}

function ensureGraftBuddy(config) {
  config.companion = {
    name: 'Graft Buddy',
    personality:
      'Proactive senior engineer: architect, debugger, reviewer, and project manager. Suggests improvements, tracks goals, explains reasoning, and never makes destructive changes without approval.',
    hatchedAt: config.companion?.hatchedAt ?? Date.now(),
  }
  config.companionMuted = false
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('graft-prep-auth.js') ||
    process.argv[1].endsWith('graft-prep-auth.mjs'))

if (isMain) {
  const key = prepareGraftAuth()
  if (key === LOCAL_PROVIDER_PLACEHOLDER_KEY) {
    console.error(noKeyMessage())
    process.exit(1)
  }
  process.stdout.write('ready\n')
}

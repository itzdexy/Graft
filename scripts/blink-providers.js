/**
 * Blink multi-provider / multi-model registry.
 *
 * Holds a catalog of Blink-compatible providers and the user's saved
 * selection + per-provider API keys in ~/.blink/providers.json.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import { getBlinkHome } from './blink-home.js'
import { writeJsonAtomic } from './blink-safe-json.js'
import {
  PROVIDER_CATALOG,
  PROVIDER_CATEGORIES,
  listProvidersByCategory,
  listProviderCategoriesOrdered,
  isMediaProviderCategory,
  getDefaultModelId,
  isCatalogModel,
} from './blink-provider-catalog.js'
import {
  isOfficialClaudeProvider,
  modelLooksLikeClaude,
} from './blink-model-compat.js'
import {
  isLocalProvider,
  LOCAL_PROVIDER_PLACEHOLDER_KEY,
} from './blink-provider-local.js'

export {
  PROVIDER_CATALOG,
  PROVIDER_CATEGORIES,
  listProvidersByCategory,
  listProviderCategoriesOrdered,
  isMediaProviderCategory,
  getDefaultModelId,
  isCatalogModel,
}

const blinkDir = join(getBlinkHome(), '.blink')
const providersPath = join(blinkDir, 'providers.json')
const legacyKeyPath = join(blinkDir, 'api-key')

// Fresh installs have no implicit provider. Selection is explicit.
export const DEFAULT_PROVIDER_ID = ''

/** Retired model ids → current catalog id (per provider when ambiguous). */
const MODEL_ALIASES = {
  'kimi-k2-0905-preview': 'kimi-k2.6',
}

function ensureDir() {
  if (!existsSync(blinkDir)) mkdirSync(blinkDir, { recursive: true })
}

function migrateProviderIds(state) {
  if (state.active === 'openai_proxy') state.active = 'openai'
  if (state.keys?.openai_proxy && !state.keys.openai) {
    state.keys = { ...state.keys, openai: state.keys.openai_proxy }
  }
  if (state.models?.openai_proxy && !state.models.openai) {
    state.models = { ...state.models, openai: state.models.openai_proxy }
  }
  if (state.endpoints?.openai_proxy && !state.endpoints.openai) {
    state.endpoints = { ...state.endpoints, openai: state.endpoints.openai_proxy }
  }
  return state
}

/** @returns {{ active: string, keys: Record<string,string>, models: Record<string,string>, custom: { baseUrl: string, label?: string }, endpoints?: Record<string,string> }} */
export function loadState() {
  const base = {
    active: DEFAULT_PROVIDER_ID,
    keys: {},
    models: {},
    custom: { baseUrl: '' },
    endpoints: {},
  }
  if (!existsSync(providersPath)) {
    if (existsSync(legacyKeyPath)) {
      const key = sanitizeKey(PROVIDER_CATALOG.freemodel, readFileSync(legacyKeyPath, 'utf8'))
      if (key) base.keys.freemodel = key
    }
    return base
  }
  try {
    const parsed = JSON.parse(readFileSync(providersPath, 'utf8'))
    return migrateProviderIds({
      active: parsed.active || DEFAULT_PROVIDER_ID,
      keys: parsed.keys || {},
      models: parsed.models || {},
      custom: parsed.custom || { baseUrl: '' },
      endpoints: parsed.endpoints || {},
    })
  } catch {
    return base
  }
}

export function saveState(state) {
  ensureDir()
  writeJsonAtomic(providersPath, state, { mode: 0o600 })
  return providersPath
}

/** Resolve a provider definition, merging saved URL overrides from state. */
export function getProvider(id, state = loadState()) {
  const def = PROVIDER_CATALOG[id]
  if (!def) return null

  const savedUrl = state.endpoints?.[id] || (id === 'custom' ? state.custom?.baseUrl : '')

  if (def.custom || def.id === 'litellm' || def.id === 'openai') {
    return {
      ...def,
      baseUrl: savedUrl || def.baseUrl || '',
      label: id === 'custom' ? state.custom?.label || def.label : def.label,
    }
  }

  if (savedUrl) {
    return { ...def, baseUrl: savedUrl }
  }

  return def
}

export function getActiveProviderId(state = loadState()) {
  return PROVIDER_CATALOG[state.active] ? state.active : DEFAULT_PROVIDER_ID
}

export function getActiveModelId(providerId, state = loadState()) {
  const provider = getProvider(providerId, state)
  if (!provider) return ''

  let saved = state.models?.[providerId]
  if (saved && MODEL_ALIASES[saved]) {
    saved = MODEL_ALIASES[saved]
  }

  if (saved && isCatalogModel(provider, saved)) {
    if (
      !isOfficialClaudeProvider(provider) &&
      modelLooksLikeClaude(saved)
    ) {
      saved = undefined
    } else {
      if (saved !== state.models?.[providerId]) {
        state.models = { ...state.models, [providerId]: saved }
        saveState(state)
      }
      return saved
    }
  }

  const fallback = getDefaultModelId(provider)
  if (saved && saved !== fallback) {
    state.models = { ...state.models, [providerId]: fallback }
    saveState(state)
  }
  return fallback
}

export function sanitizeKey(provider, raw) {
  if (!raw || typeof raw !== 'string') return ''
  let key = raw.trim().replace(/[<>]/g, '').trim()
  const prefix = provider?.keyPrefix
  if (prefix) {
    const doubled = prefix + prefix
    while (key.startsWith(doubled)) key = key.slice(prefix.length)
  }
  return key
}

export function isValidKey(provider, key) {
  if (isLocalProvider(provider)) return true
  if (!key || typeof key !== 'string') return false
  const trimmed = sanitizeKey(provider, key)
  if (trimmed.length < 8) return false
  if (provider?.keyPrefix && !trimmed.startsWith(provider.keyPrefix)) return false
  if (provider?.keyPrefix && trimmed === provider.keyPrefix) return false
  return true
}

/** API key for a provider (saved key or BLINK_API_KEY for freemodel). */
export function getProviderApiKey(providerId, state = loadState()) {
  const envKey = process.env.BLINK_API_KEY?.trim()
  if (providerId === 'freemodel' && envKey) return envKey
  return state.keys?.[providerId] || ''
}

/** True when the user has saved a valid API key for this provider. */
export function isProviderActivated(providerId, state = loadState()) {
  const def = getProvider(providerId, state)
  if (!def) return false
  if (isLocalProvider(def)) return Boolean(def.baseUrl)
  return isValidKey(def, getProviderApiKey(providerId, state))
}

/** Provider ids with a saved valid API key, in catalog category order. */
export function listActivatedProviderIds(state = loadState()) {
  return listProviderIds().filter(id => isProviderActivated(id, state))
}

/**
 * @returns {{ providerId: string, label: string, baseUrl: string, apiKey: string, model: string, authMode: 'apiKey'|'authToken' }|null}
 */
export function resolveActive(state = loadState()) {
  const envKey = process.env.BLINK_API_KEY?.trim()
  if (envKey) {
    state.keys = { ...state.keys, freemodel: envKey }
  }

  const providerId = getActiveProviderId(state)
  const provider = getProvider(providerId, state)
  if (!provider) return null

  const apiKey = sanitizeKey(provider, state.keys?.[providerId] || '')
  const effectiveKey = isLocalProvider(provider)
    ? apiKey || LOCAL_PROVIDER_PLACEHOLDER_KEY
    : apiKey
  if (!isValidKey(provider, effectiveKey)) return null
  if ((provider.custom || provider.id === 'openai') && !provider.baseUrl) return null

  return {
    providerId,
    label: provider.label,
    baseUrl: provider.baseUrl,
    apiKey: effectiveKey,
    model: getActiveModelId(providerId, state),
    authMode: provider.authMode || 'apiKey',
  }
}

export function setActiveProvider(id) {
  if (id === '') {
    const state = loadState()
    state.active = ''
    saveState(state)
    return state
  }
  if (!PROVIDER_CATALOG[id]) throw new Error(`Unknown provider: ${id}`)
  const state = loadState()
  state.active = id
  saveState(state)
  return state
}

export function setProviderKey(id, key) {
  if (!PROVIDER_CATALOG[id]) throw new Error(`Unknown provider: ${id}`)
  const state = loadState()
  const clean = sanitizeKey(getProvider(id, state), key)
  state.keys = { ...state.keys, [id]: clean }
  saveState(state)
  return state
}

export function setActiveModel(modelId, providerId) {
  const state = loadState()
  const id = providerId || getActiveProviderId(state)
  const provider = getProvider(id, state)
  let next = modelId
  if (MODEL_ALIASES[next]) next = MODEL_ALIASES[next]
  if (provider && !isCatalogModel(provider, next)) {
    const valid = (provider.models || []).map(m => m.id)
    const hint = valid.length
      ? ` Valid models: ${valid.slice(0, 8).join(', ')}${valid.length > 8 ? ', …' : ''}.`
      : ''
    throw new Error(
      `Model "${modelId}" is not supported by ${provider.label}.${hint} Run /model to choose one.`,
    )
  }
  state.models = { ...state.models, [id]: next }
  saveState(state)
  return state
}

export function setCustomProvider({ baseUrl, label, providerId }) {
  const state = loadState()
  const id = providerId || 'custom'
  const url = baseUrl?.trim() || ''
  if (id === 'custom') {
    state.custom = {
      ...state.custom,
      baseUrl: url || state.custom?.baseUrl || '',
      label: label?.trim() || state.custom?.label,
    }
  }
  if (url) {
    state.endpoints = { ...state.endpoints, [id]: url }
  }
  saveState(state)
  return state
}

export function listProviderIds() {
  return Object.keys(PROVIDER_CATALOG).filter(id => id !== 'openai_proxy')
}

if (process.argv[1]?.endsWith('blink-providers.js')) {
  const active = resolveActive()
  if (!active) {
    console.error('No active provider configured. Run: blink auth login --key <key>')
    process.exit(1)
  }
  console.log(JSON.stringify(active, null, 2))
}

import { getProvider, resolveActive } from '../../scripts/blink-providers.js'
import { providerNeedsOpenAiCompat } from '../../scripts/blink-provider-upstream.js'
import {
  applyOpenAiCompatProxyEnv,
  stopOpenAiCompatProxy,
} from './openaiCompat/proxy.js'

export type ActiveProviderLike = {
  providerId: string
  baseUrl: string
  apiKey: string
  model?: string
  authMode?: 'apiKey' | 'authToken'
}

/** Env keys for direct Blink routing (no OpenAI-compat proxy). */
export function buildDirectAnthropicEnvPatch(
  active: ActiveProviderLike,
): Record<string, string | undefined> {
  const patch: Record<string, string | undefined> = {
    ANTHROPIC_BASE_URL: active.baseUrl,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: undefined,
    ANTHROPIC_DEFAULT_SONNET_MODEL: undefined,
    ANTHROPIC_DEFAULT_OPUS_MODEL: undefined,
    CLAUDE_CODE_SUBAGENT_MODEL: undefined,
  }
  if (active.model) {
    patch.ANTHROPIC_MODEL = active.model
  } else {
    patch.ANTHROPIC_MODEL = undefined
  }
  if (active.authMode === 'authToken') {
    patch.ANTHROPIC_AUTH_TOKEN = active.apiKey
    patch.ANTHROPIC_API_KEY = ''
  } else {
    patch.ANTHROPIC_API_KEY = active.apiKey
    patch.ANTHROPIC_AUTH_TOKEN = undefined
  }
  return patch
}

function applyEnvPatch(patch: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

/** Point process.env at the active provider (with OpenAI-compat proxy when needed). */
export function applyBlinkActiveProviderToEnv(active: ActiveProviderLike): void {
  const def = getProvider(active.providerId)
  const upstreamKey = active.apiKey || 'local'
  if (providerNeedsOpenAiCompat(def) && upstreamKey) {
    if (active.model) {
      process.env.ANTHROPIC_MODEL = active.model
    } else {
      delete process.env.ANTHROPIC_MODEL
    }
    applyOpenAiCompatProxyEnv({
      providerId: active.providerId,
      upstreamBaseUrl: active.baseUrl,
      upstreamApiKey: upstreamKey,
    })
    if (active.model) {
      process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = active.model
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = active.model
      process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = active.model
      process.env.CLAUDE_CODE_SUBAGENT_MODEL = active.model
    }
    return
  }

  stopOpenAiCompatProxy()
  applyEnvPatch(buildDirectAnthropicEnvPatch(active))
}

/** Re-apply ~/.blink routing after settings.env (sync). */
export function reapplyBlinkProviderEnvFromDisk(): void {
  if (
    !process.env.BLINK_PACKAGE_ROOT &&
    !process.env.BLINK_SRC &&
    process.env.BLINK_FORCE_INTERACTIVE !== '1'
  ) {
    return
  }

  const active = resolveActive()
  if (!active?.apiKey) return

  applyBlinkActiveProviderToEnv({
    providerId: active.providerId,
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model: active.model,
    authMode: active.authMode,
  })
}

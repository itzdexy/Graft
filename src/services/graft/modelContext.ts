import {
  getActiveProviderId,
  getProvider,
} from '../../../scripts/graft-providers.js'
import {
  getCachedProviderModelDescriptors,
  getCachedProviderModelDescriptorsFor,
} from './providerModels.js'

type AnthropicLikeRequest = {
  model: string
  max_tokens: number
  messages: Array<{
    role: string
    content: string | Array<{ type: string; text?: string; content?: unknown }>
  }>
  system?: string | Array<{ type: string; text?: string; content?: unknown }>
  tools?: unknown[]
}

/** Conservative default when catalog has no context hint. */
export const GRAFT_DEFAULT_CONTEXT_WINDOW = 32_768

const MIN_OPENAI_OUTPUT = 256
const OPENAI_OUTPUT_HEADROOM = 512
const INPUT_PREFLIGHT_SAFETY_TOKENS = 1_024

function parseContextString(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(k|m)?$/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  if (m[2] === 'm') return Math.round(n * 1_000_000)
  if (m[2] === 'k') return Math.round(n * 1_000)
  return Math.round(n)
}

/** Infer context window from model id patterns (NVIDIA / OpenRouter style). */
export function inferContextWindowFromModelId(modelId: string): number | null {
  const id = modelId.toLowerCase()

  const explicit = id.match(/(?:^|[/_-])(\d+)k(?:[/_-]|$)/)
  if (explicit?.[1]) {
    const n = Number(explicit[1])
    if (n > 0 && n <= 2_000) return n * 1_000
  }

  if (id.includes('32768')) return 32_768
  if (id.includes('131072') || id.includes('128k')) return 131_072
  if (id.includes('65536') || id.includes('64k')) return 65_536

  if (id.includes('llama-3.2-90b') || id.includes('llama-3.2-11b')) {
    return 32_768
  }
  if (id.includes('llama-3.2-3b') || id.includes('llama-3.2-1b')) {
    return 131_072
  }
  if (id.includes('llama-3.3')) {
    return 131_072
  }
  if (id.includes('llama-3.1')) {
    return 131_072
  }
  if (id.includes('phi-3-mini-128k') || id.includes('phi-3-medium-128k')) {
    return 131_072
  }

  // Modern flagship families that do not embed context size in their id.
  // These are best-effort defaults to avoid premature auto-compact loops.
  if (id.includes('muse-spark')) {
    return 1_000_000
  }
  if (id.includes('claude-opus-4') || id.includes('claude-sonnet-5')) {
    return 200_000
  }
  if (id.includes('claude-fable-5') || id.includes('claude-mythos-5')) {
    return 200_000
  }
  if (id.includes('gpt-5.6') || id.includes('gpt-5.5')) {
    return 128_000
  }
  if (id.includes('/o3') || id.includes('/o4-mini')) {
    return 200_000
  }
  if (id.includes('gemini-')) {
    return 1_000_000
  }
  if (id.includes('glm-5') || id.includes('glm-4')) {
    return 128_000
  }
  if (id.includes('deepseek-v4') || id.includes('deepseek-r1')) {
    return 128_000
  }
  if (id.includes('nemotron-3-nano-30b-a3b')) {
    return 262_144
  }
  // NVIDIA NIM's published Lightning context limit; live endpoint metadata wins.
  // https://docs.nvidia.com/nim/large-language-models/2.0.10/get-started/advanced/get-started-nemotron-3.5-lightning.html
  if (id.includes('nemotron-3.5-lightning-30b-a3b')) return 262_144
  if (id.includes('kimi-k3') || id.includes('kimi-k2.7')) {
    return 256_000
  }
  if (id.includes('grok-4')) {
    return 128_000
  }

  return null
}

/**
 * Context length the provider itself reported for this model.
 *
 * OpenRouter returns `context_length` for every model and Graft already parses
 * and caches it — it just was not consulted here, so any model missing from the
 * static catalog fell through to the 32k default no matter what the provider
 * said. A cloaked or newly released id (`stealth/ox-alpha`) matches no catalog
 * entry and no id heuristic, so a 128k+ model was being compacted as if it held
 * 32k: constant summarisation, an extra model round trip each time, and output
 * capped at the 32k tier's 8k ceiling.
 *
 * This is authoritative when present — it is the provider describing its own
 * model, which beats both the bundled catalog and any guess from the id.
 */
function lookupProviderReportedContext(
  modelId: string,
  providerId?: string,
): number | null {
  const descriptors = providerId
    ? getCachedProviderModelDescriptorsFor(providerId)
    : getCachedProviderModelDescriptors()
  if (!descriptors?.length) return null

  const entry = descriptors.find(descriptor => descriptor.id === modelId)
  const reported = entry?.contextTokens
  if (typeof reported !== 'number' || !Number.isFinite(reported)) return null
  // Guard against a provider reporting nonsense; a sub-1k window would make
  // every request unsendable.
  return reported >= 1_000 ? Math.floor(reported) : null
}

export function lookupCatalogModelContext(
  modelId: string,
  providerId?: string,
): number | null {
  const reported = lookupProviderReportedContext(modelId, providerId)
  if (reported !== null) return reported

  const pid = providerId ?? getActiveProviderId()
  const provider = getProvider(pid)
  if (!provider?.models?.length) {
    return inferContextWindowFromModelId(modelId)
  }

  const entry = provider.models.find(m => m.id === modelId)
  if (entry?.context) {
    return parseContextString(entry.context) ?? inferContextWindowFromModelId(modelId)
  }

  return inferContextWindowFromModelId(modelId)
}

/** Where a context-window number came from, for /status and doctor. */
export type ContextWindowSource =
  | 'provider'
  | 'catalog'
  | 'inferred'
  | 'default'

/**
 * The window plus its provenance.
 *
 * A wrong context window is invisible: it renders as a plausible percentage
 * and nothing says where the number came from. stealth/ox-alpha ran at 32k
 * against a real 1,048,576 for as long as it took someone to notice the bar
 * filling too fast. Surfacing the source turns that into a visible fact.
 */
export function describeGraftContextWindow(
  modelId: string,
  providerId?: string,
): { tokens: number; source: ContextWindowSource } {
  const reported = lookupProviderReportedContext(modelId, providerId)
  if (reported !== null) return { tokens: reported, source: 'provider' }

  const pid = providerId ?? getActiveProviderId()
  const provider = getProvider(pid)
  const entry = provider?.models?.find(m => m.id === modelId)
  if (entry?.context) {
    const parsed = parseContextString(entry.context)
    if (parsed !== null) return { tokens: parsed, source: 'catalog' }
  }

  const inferred = inferContextWindowFromModelId(modelId)
  if (inferred !== null) return { tokens: inferred, source: 'inferred' }

  return { tokens: GRAFT_DEFAULT_CONTEXT_WINDOW, source: 'default' }
}
export function getGraftModelContextWindow(
  modelId: string,
  providerId?: string,
): number {
  return (
    lookupCatalogModelContext(modelId, providerId) ?? GRAFT_DEFAULT_CONTEXT_WINDOW
  )
}

/**
 * Output ceiling the provider itself reported for this model.
 *
 * OpenRouter returns top_provider.max_completion_tokens and Graft already
 * parses and caches it as ModelDescriptor.maxOutputTokens — nothing ever read
 * it. getGraftMaxOutputLimits infers a ceiling from the context window in four
 * coarse tiers instead, which tops out at 32k. stealth/ox-alpha reports
 * 131,072, so replies were being cut to a quarter of what the model can
 * actually emit, for no reason other than the value not being wired up.
 */
function lookupProviderReportedMaxOutput(
  modelId: string,
  providerId?: string,
): number | null {
  const descriptors = providerId
    ? getCachedProviderModelDescriptorsFor(providerId)
    : getCachedProviderModelDescriptors()
  if (!descriptors?.length) return null

  const entry = descriptors.find(descriptor => descriptor.id === modelId)
  const reported = entry?.maxOutputTokens
  if (typeof reported !== 'number' || !Number.isFinite(reported)) return null
  return reported >= 256 ? Math.floor(reported) : null
}

/**
 * Output limits for a model, preferring what the provider reported.
 *
 * Only the upper limit is raised. The default stays on the conservative tier
 * value: max_tokens is reserved capacity, so defaulting to a model's full
 * 131k ceiling over-reserves on every request for a response that is almost
 * always a few thousand tokens. Raising the ceiling is what lets the
 * escalation path ask for more when a reply actually needs it.
 */
export function getGraftMaxOutputLimitsForModel(
  modelId: string,
  providerId?: string,
): { default: number; upperLimit: number } {
  const contextWindow = getGraftModelContextWindow(modelId, providerId)
  const tiered = getGraftMaxOutputLimits(contextWindow)

  const reported = lookupProviderReportedMaxOutput(modelId, providerId)
  if (reported === null) return tiered

  // Output still has to fit alongside some input.
  const roomInWindow = Math.max(1, contextWindow - INPUT_PREFLIGHT_SAFETY_TOKENS)
  const upperLimit = Math.max(tiered.upperLimit, Math.min(reported, roomInWindow))
  return { default: Math.min(tiered.default, upperLimit), upperLimit }
}
export function getGraftMaxOutputLimits(contextWindow: number): {
  default: number
  upperLimit: number
} {
  if (contextWindow <= 8_192) {
    return { default: 1_024, upperLimit: 2_048 }
  }
  if (contextWindow <= 32_768) {
    return { default: 4_096, upperLimit: 8_192 }
  }
  if (contextWindow <= 65_536) {
    return { default: 8_192, upperLimit: 16_384 }
  }
  return { default: 8_000, upperLimit: 32_000 }
}

function blocksToText(
  blocks: Array<{ type: string; text?: string; content?: unknown }>,
): string {
  return blocks
    .map(block => {
      if (block.type === 'text' && typeof block.text === 'string') {
        return block.text
      }
      if (block.type === 'tool_result') {
        if (typeof block.content === 'string') return block.content
        if (Array.isArray(block.content)) return blocksToText(block.content)
      }
      if (block.type === 'tool_use') {
        const tool = block as { name?: string; input?: unknown }
        return `${tool.name ?? ''} ${JSON.stringify(tool.input ?? {})}`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

/** Rough token estimate for OpenAI-compat context budgeting (conservative). */
export function estimateAnthropicRequestInputTokens(
  body: AnthropicLikeRequest,
): number {
  let chars = 0
  const add = (s: string) => {
    chars += s.length
  }

  if (typeof body.system === 'string') add(body.system)
  else if (Array.isArray(body.system)) add(blocksToText(body.system))

  for (const message of body.messages) {
    if (typeof message.content === 'string') {
      add(message.content)
    } else if (Array.isArray(message.content)) {
      add(blocksToText(message.content))
    }
  }

  if (body.tools?.length) {
    add(JSON.stringify(body.tools))
  }

  return Math.max(1, Math.ceil(chars / 3.5) + body.messages.length * 8)
}

/** Ensure max_tokens + input fit inside the model context window. */
export function capMaxTokensForContextWindow(
  requestedMaxTokens: number,
  contextWindow: number,
  estimatedInputTokens: number,
): number {
  const available =
    contextWindow - estimatedInputTokens - OPENAI_OUTPUT_HEADROOM
  if (available < MIN_OPENAI_OUTPUT) {
    return MIN_OPENAI_OUTPUT
  }
  return Math.max(
    MIN_OPENAI_OUTPUT,
    Math.min(requestedMaxTokens, available),
  )
}

export function capAnthropicMaxTokensForGraftModel(
  body: AnthropicLikeRequest,
  providerId?: string,
): number {
  const contextWindow = getGraftModelContextWindow(body.model, providerId)
  const inputTokens = estimateAnthropicRequestInputTokens(body)
  const { upperLimit } = getGraftMaxOutputLimitsForModel(body.model, providerId)
  const requested = Math.min(body.max_tokens, upperLimit)
  return capMaxTokensForContextWindow(requested, contextWindow, inputTokens)
}

export type GraftContextPreflightResult =
  | { ok: true; estimatedInputTokens: number; contextWindow: number }
  | {
      ok: false
      estimatedInputTokens: number
      contextWindow: number
      maxInputTokens: number
      message: string
    }

export function preflightAnthropicRequestContext(
  body: AnthropicLikeRequest,
  providerId?: string,
): GraftContextPreflightResult {
  const contextWindow = getGraftModelContextWindow(body.model, providerId)
  const estimatedInputTokens = estimateAnthropicRequestInputTokens(body)
  const maxTokens = capAnthropicMaxTokensForGraftModel(body, providerId)
  const maxInputTokens = Math.max(
    1,
    contextWindow - maxTokens - OPENAI_OUTPUT_HEADROOM - INPUT_PREFLIGHT_SAFETY_TOKENS,
  )

  if (estimatedInputTokens <= maxInputTokens) {
    return { ok: true, estimatedInputTokens, contextWindow }
  }

  return {
    ok: false,
    estimatedInputTokens,
    contextWindow,
    maxInputTokens,
    message:
      `Graft stopped this request before sending it because the active model ` +
      `(${body.model}) appears to have too much input for its context window. ` +
      `Estimated input: ${estimatedInputTokens.toLocaleString()} tokens. ` +
      `Model window: ${contextWindow.toLocaleString()} tokens. ` +
      `Try /compact, /clear, switching to a larger-context model with /model, ` +
      `or starting a fresh session in this project.`,
  }
}

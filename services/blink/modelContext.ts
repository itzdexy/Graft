import {
  getActiveProviderId,
  getProvider,
} from '../../scripts/blink-providers.js'

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
export const BLINK_DEFAULT_CONTEXT_WINDOW = 32_768

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
  if (id.includes('phi-3-mini-128k') || id.includes('phi-3-medium-128k')) {
    return 131_072
  }

  return null
}

export function lookupCatalogModelContext(
  modelId: string,
  providerId?: string,
): number | null {
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

export function getBlinkModelContextWindow(
  modelId: string,
  providerId?: string,
): number {
  return (
    lookupCatalogModelContext(modelId, providerId) ?? BLINK_DEFAULT_CONTEXT_WINDOW
  )
}

export function getBlinkMaxOutputLimits(contextWindow: number): {
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

  return Math.max(1, Math.ceil(chars / 3.5))
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

export function capAnthropicMaxTokensForBlinkModel(
  body: AnthropicLikeRequest,
  providerId?: string,
): number {
  const contextWindow = getBlinkModelContextWindow(body.model, providerId)
  const inputTokens = estimateAnthropicRequestInputTokens(body)
  const { upperLimit } = getBlinkMaxOutputLimits(contextWindow)
  const requested = Math.min(body.max_tokens, upperLimit)
  return capMaxTokensForContextWindow(requested, contextWindow, inputTokens)
}

export type BlinkContextPreflightResult =
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
): BlinkContextPreflightResult {
  const contextWindow = getBlinkModelContextWindow(body.model, providerId)
  const estimatedInputTokens = estimateAnthropicRequestInputTokens(body)
  const maxTokens = capAnthropicMaxTokensForBlinkModel(body, providerId)
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
      `Blink stopped this request before sending it because the active model ` +
      `(${body.model}) appears to have too much input for its context window. ` +
      `Estimated input: ${estimatedInputTokens.toLocaleString()} tokens. ` +
      `Model window: ${contextWindow.toLocaleString()} tokens. ` +
      `Try /compact, /clear, switching to a larger-context model with /model, ` +
      `or starting a fresh session in this project.`,
  }
}

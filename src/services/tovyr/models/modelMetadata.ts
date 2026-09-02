/**
 * Model metadata parsing — pricing, capabilities and the tags shown in `/model`.
 *
 * Provider model endpoints return far more than an id. OpenRouter alone gives
 * per-token pricing, context length, input modalities and the parameter list
 * (which is how you know whether a model can call tools). Tovyr used to discard
 * all of it and keep only `id`, which is why the picker could not say whether a
 * model was free, how big its context was, or whether it could run agent work.
 *
 * Pure and side-effect free so the tag rules are testable without a network.
 */

export type ModelPricing = {
  /** USD per million prompt tokens. */
  promptPerM: number
  /** USD per million completion tokens. */
  completionPerM: number
}

/** Providers quote per-token prices, usually as strings ("0.000003"). */
const TOKENS_PER_MILLION = 1_000_000

/**
 * Parse a provider pricing object. Returns null when pricing is absent or
 * unparseable — which is different from free, and must stay different: showing
 * "FREE" on a model we simply have no price for would be a lie.
 */
export function parseModelPricing(raw: unknown): ModelPricing | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>

  const read = (...keys: string[]): number | null => {
    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
      }
    }
    return null
  }

  const prompt = read('prompt', 'input', 'input_cost_per_token')
  const completion = read('completion', 'output', 'output_cost_per_token')
  if (prompt === null && completion === null) return null

  return {
    promptPerM: (prompt ?? 0) * TOKENS_PER_MILLION,
    completionPerM: (completion ?? 0) * TOKENS_PER_MILLION,
  }
}

/** True only when the provider explicitly quoted zero on both sides. */
export function isFreeModel(pricing: ModelPricing | null): boolean {
  if (!pricing) return false
  return pricing.promptPerM === 0 && pricing.completionPerM === 0
}

/**
 * Short price label for a picker row. Prompt price is the one people compare,
 * so it leads; sub-dollar prices keep two decimals so $0.15 and $0.60 stay
 * distinguishable.
 */
export function formatPriceTag(pricing: ModelPricing | null): string | null {
  if (!pricing) return null
  if (isFreeModel(pricing)) return 'FREE'
  const value = pricing.promptPerM
  if (value <= 0) return null
  const rendered =
    value < 1 ? value.toFixed(2) : value < 10 ? value.toFixed(1) : String(Math.round(value))
  return `$${rendered}/M`
}

/** Human context-window label: 1000000 -> "1M ctx", 128000 -> "128k ctx". */
export function formatContextTag(contextTokens: number | null): string | null {
  if (!contextTokens || contextTokens <= 0) return null
  if (contextTokens >= 1_000_000) {
    // 1048576 (a real OpenRouter value) should read "1M", not "1.0M".
    const millions = contextTokens / 1_000_000
    const rounded = Math.round(millions * 10) / 10
    const rendered = Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(1)
    return `${rendered}M ctx`
  }
  return `${Math.round(contextTokens / 1000)}k ctx`
}

export type RawModelCapabilities = {
  /** OpenRouter `supported_parameters`. */
  supportedParameters?: unknown
  /** OpenRouter `architecture`. */
  architecture?: unknown
  contextTokens?: number | null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/** Does the provider say this model accepts tool definitions? */
export function parseSupportsTools(raw: RawModelCapabilities): boolean | null {
  const params = asStringArray(raw.supportedParameters)
  if (params.length === 0) return null
  return params.includes('tools') || params.includes('tool_choice')
}

/**
 * Every input modality the model accepts, lowercased ("text", "image",
 * "audio", "video"). Empty when the provider does not say.
 */
export function parseInputModalities(raw: RawModelCapabilities): string[] {
  const architecture = raw.architecture
  if (!architecture || typeof architecture !== 'object') return []
  const record = architecture as Record<string, unknown>

  const listed = asStringArray(record.input_modalities)
  if (listed.length > 0) return listed.map(m => m.toLowerCase())

  // Older shape: "text+image->text".
  const modality = record.modality
  if (typeof modality === 'string') {
    return (modality.split('->')[0] ?? '')
      .split('+')
      .map(m => m.trim().toLowerCase())
      .filter(Boolean)
  }
  return []
}

/** Does the model accept images? */
export function parseSupportsVision(raw: RawModelCapabilities): boolean | null {
  const architecture = raw.architecture
  if (!architecture || typeof architecture !== 'object') return null
  const record = architecture as Record<string, unknown>

  const inputModalities = asStringArray(record.input_modalities)
  if (inputModalities.length > 0) return inputModalities.includes('image')

  const modality = record.modality
  if (typeof modality === 'string') {
    const inputs = modality.split('->')[0] ?? ''
    return inputs.includes('image')
  }
  return null
}

export type ModelTagInput = {
  pricing: ModelPricing | null
  contextTokens: number | null
  /** Ceiling on a single response. */
  maxOutputTokens?: number | null
  /** Input modalities beyond text: image, audio, video. */
  modalities?: readonly string[]
  supportsTools: boolean | null
  supportsVision: boolean | null
  /** Runs on this machine — no key, no cost, no network. */
  local?: boolean
  /**
   * The model cannot run agent work (embeddings, moderation, TTS). Shown as a
   * tag rather than filtered out, so a user looking for it can still find it.
   */
  notAgentCapable?: boolean
}

/**
 * Tags for one picker row, most decision-relevant first.
 *
 * Ordering is deliberate: price is what people filter on, then whether it can
 * actually do the job (tools), then capacity, then extras.
 */
export function deriveModelTags(input: ModelTagInput): string[] {
  const tags: string[] = []

  if (input.local) tags.push('LOCAL')
  else {
    const price = formatPriceTag(input.pricing)
    if (price) tags.push(price)
  }

  if (input.notAgentCapable) tags.push('NO TOOLS')
  else if (input.supportsTools === true) tags.push('TOOLS')

  const context = formatContextTag(input.contextTokens)
  if (context) tags.push(context)

  const out = formatMaxOutputTag(input.maxOutputTokens ?? null)
  if (out) tags.push(out)

  // Modality tags come from the provider's own list, so an audio or video
  // model is findable instead of being indistinguishable from a text one.
  // "text" is the assumed baseline and would tag literally every row.
  const extras = (input.modalities ?? [])
    .filter(m => m !== 'text')
    .map(m => m.toUpperCase())
  if (extras.length > 0) {
    for (const modality of extras) tags.push(modality)
  } else if (input.supportsVision === true) {
    tags.push('IMAGE')
  }

  return tags
}

/** Response ceiling: 32768 -> "32k out". */
export function formatMaxOutputTag(maxOutputTokens: number | null): string | null {
  if (!maxOutputTokens || maxOutputTokens <= 0) return null
  if (maxOutputTokens >= 1000) return `${Math.round(maxOutputTokens / 1000)}k out`
  return `${maxOutputTokens} out`
}

/**
 * Search behaviour for the `/provider` and `/model` pickers.
 *
 * Kept as pure functions over plain row shapes so the ranking is testable
 * without rendering Ink. The picker components own presentation; this module
 * owns "what does typing `opus` show me".
 */

import { fuzzyRank, type FuzzyField, type FuzzyResult } from './fuzzy.js'

/**
 * Brand nicknames — another name for the *company*, not for one of its models.
 * Without these, searching "claude" in the provider list misses Anthropic
 * entirely and "chatgpt" misses OpenAI, which is the single most common way
 * the old picker "didn't work".
 *
 * These are safe to fold into model search too: every Anthropic model really
 * is a "claude" model.
 */
export const PROVIDER_BRAND_ALIASES: Record<string, string[]> = {
  anthropic: ['claude'],
  openai: ['chatgpt'],
  google: ['gemini', 'bard'],
  'google-vertex': ['gemini', 'vertex'],
  vertex: ['gemini', 'google'],
  bedrock: ['aws', 'amazon'],
  azure: ['microsoft', 'aoai'],
  xai: ['grok'],
  moonshot: ['kimi'],
  zhipu: ['glm', 'chatglm'],
  alibaba: ['qwen', 'dashscope'],
  dashscope: ['qwen', 'alibaba'],
  perplexity: ['sonar', 'pplx'],
  huggingface: ['hf', 'hub'],
  lmstudio: ['lm studio'],
  llamacpp: ['llama.cpp'],
  freemodel: ['free', 'bundled'],
}

/**
 * Hints that describe what a provider *carries* or how it runs. Useful when
 * choosing a provider ("who serves llama?", "what works offline?"), but
 * deliberately excluded from model search: folding "opus" into Anthropic
 * would make every Anthropic model match the query "opus".
 */
export const PROVIDER_CATALOG_HINTS: Record<string, string[]> = {
  anthropic: ['opus', 'sonnet', 'haiku'],
  openai: ['gpt', 'codex', 'o1', 'o3'],
  groq: ['llama', 'fast'],
  cerebras: ['llama', 'fast'],
  together: ['llama', 'qwen', 'mixtral'],
  fireworks: ['llama', 'qwen'],
  openrouter: ['router', 'any', 'all'],
  ollama: ['local', 'offline'],
  lmstudio: ['local', 'offline'],
  llamacpp: ['local', 'offline'],
  vllm: ['local', 'self hosted'],
  deepseek: ['r1', 'v3'],
  mistral: ['mixtral', 'codestral'],
  freemodel: ['default'],
}

/** Brand nicknames only — safe in both provider and model search. */
export function providerBrandAliases(providerId: string): string[] {
  return PROVIDER_BRAND_ALIASES[providerId.toLowerCase()] ?? []
}

/** Everything worth matching when picking a *provider*. */
export function providerSearchAliases(providerId: string): string[] {
  const id = providerId.toLowerCase()
  return [
    ...(PROVIDER_BRAND_ALIASES[id] ?? []),
    ...(PROVIDER_CATALOG_HINTS[id] ?? []),
  ]
}

export type ProviderSearchRow = {
  id: string
  label: string
  /** Raw category id, e.g. "gateway". */
  category: string
  /** Human category label, e.g. "Gateways". */
  categoryLabel: string
  keyHint?: string
  /** A usable key/endpoint is already saved (or the runtime is local). */
  connected: boolean
  /** Runs on this machine — usable with no network. */
  local: boolean
  /** Currently the active provider. */
  active: boolean
  /** Accepts arbitrary model ids. */
  anyModel?: boolean
}

/**
 * Rank providers for a query. An empty query returns every row untouched,
 * so the caller's grouping/ordering survives.
 */
export function searchProviders(
  rows: readonly ProviderSearchRow[],
  query: string,
): FuzzyResult<ProviderSearchRow>[] {
  return fuzzyRank(rows, query, row => {
    const fields: FuzzyField[] = [
      { text: row.label, weight: 1, highlight: true },
      { text: row.id, weight: 0.95 },
      { text: row.categoryLabel, weight: 0.45 },
    ]
    for (const alias of providerSearchAliases(row.id)) {
      fields.push({ text: alias, weight: 0.8 })
    }
    if (row.keyHint) fields.push({ text: row.keyHint, weight: 0.3 })
    return fields
  })
}

export type ModelSearchRow = {
  providerId: string
  providerLabel: string
  modelId: string
  /** Display label, e.g. "Claude Opus 4.5". */
  label: string
  /** Internal tier id: opus | sonnet | haiku. Not searched — see tierLabel. */
  tier?: string
  /**
   * Human tier name shown in the list ("Best", "Balanced", "Fast").
   *
   * The raw tier ids reuse Anthropic model names, so searching them would make
   * "sonnet" return Gemini and Llama rows. The label is what the user sees and
   * the only tier text worth matching.
   */
  tierLabel?: string
  /** Provider listed this id on its live /v1/models endpoint. */
  verified?: boolean
  /** Currently the active model on its provider. */
  active?: boolean
  /** Provider has a saved key / local runtime. */
  connected?: boolean
  /** Display chips: FREE, $3.0/M, TOOLS, 1M ctx, VISION. */
  tags?: string[]
}

/**
 * `provider/model` — the id form opencode uses and users paste into configs.
 *
 * Some catalog ids already carry their own namespace. A gateway keeps it
 * (`openrouter/anthropic/claude-haiku-4-5` is the real routable id), but a
 * first-party provider repeating itself is not: the OpenAI catalog stores
 * `openai/gpt-5.5`, which naive joining rendered as `openai/openai/gpt-5.5`.
 */
export function qualifiedModelId(row: {
  providerId: string
  modelId: string
}): string {
  const prefix = `${row.providerId}/`
  if (row.modelId.toLowerCase().startsWith(prefix.toLowerCase())) {
    return row.modelId
  }
  return prefix + row.modelId
}

/**
 * Rank models for a query across one or many providers.
 *
 * Matching covers the display label, the bare model id, the qualified
 * `provider/model` id, and the provider label + its nicknames — so "opus",
 * "claude-opus-4-5", "anthropic/opus" and "claude opus" all find the same row.
 */
export function searchModels(
  rows: readonly ModelSearchRow[],
  query: string,
): FuzzyResult<ModelSearchRow>[] {
  return fuzzyRank(rows, query, row => {
    const fields: FuzzyField[] = [
      { text: row.label, weight: 1, highlight: true },
      { text: row.modelId, weight: 0.95 },
      { text: qualifiedModelId(row), weight: 0.9 },
      { text: row.providerLabel, weight: 0.55 },
      { text: row.providerId, weight: 0.55 },
    ]
    for (const alias of providerBrandAliases(row.providerId)) {
      fields.push({ text: alias, weight: 0.5 })
    }
    if (row.tierLabel) fields.push({ text: row.tierLabel, weight: 0.35 })
    // Tags are searchable so "free", "vision" and "tools" narrow the list.
    for (const tag of row.tags ?? []) {
      fields.push({ text: tag, weight: 0.4 })
    }
    return fields
  })
}

/**
 * Should a free-form model id be offered as a "use it anyway" escape hatch?
 *
 * True when the provider takes arbitrary ids and the query looks like an id
 * that is not already in the list. This is what makes a brand-new model
 * reachable the day it ships, instead of waiting for a catalog update.
 */
export function shouldOfferCustomModelId(input: {
  query: string
  anyModel: boolean
  matches: readonly ModelSearchRow[]
}): boolean {
  const candidate = input.query.trim()
  if (!input.anyModel) return false
  if (candidate.length < 2) return false
  if (/\s/.test(candidate)) return false
  return !input.matches.some(
    row =>
      row.modelId.toLowerCase() === candidate.toLowerCase() ||
      qualifiedModelId(row).toLowerCase() === candidate.toLowerCase(),
  )
}

/**
 * Summary line under the search box: "12 of 308 models · 4 providers".
 * Rendering a count is the cheapest way to tell someone their query matched
 * nothing versus the list simply being scrolled.
 */
export function formatSearchSummary(input: {
  shown: number
  total: number
  noun: string
  query: string
  providerCount?: number
}): string {
  const noun = input.total === 1 ? input.noun : `${input.noun}s`
  const head = input.query.trim()
    ? `${input.shown} of ${input.total} ${noun}`
    : `${input.total} ${noun}`
  if (!input.providerCount) return head
  const providers =
    input.providerCount === 1 ? '1 provider' : `${input.providerCount} providers`
  return `${head} · ${providers}`
}

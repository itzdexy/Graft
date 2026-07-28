/**
 * Built-in Tovyr provider catalog.
 *
 * Every entry must expose the Tovyr Messages API (native or via a
 * compatibility gateway). Tovyr routes via ANTHROPIC_BASE_URL + model + key.
 *
 * Thousands of models: the `models` array on each provider is only a curated
 * quick-pick list. Any provider accepts a free-form model id via
 * `/provider model <id>` (or `TOVYR_DEFAULT_MODEL`), and gateways flagged
 * `anyModel: true` (OpenRouter 400+, Portkey 3000+, HuggingFace, AIMLAPI, …)
 * resolve essentially every model their platform offers. Plus unlimited
 * `custom` endpoints. So the catalog is the on-ramp, not the ceiling.
 *
 * @typedef {{ id: string, label: string, tier: 'opus'|'sonnet'|'haiku', context?: string }} ModelDef
 * @typedef {'direct'|'gateway'|'api'|'regional'|'cloud'|'self_hosted'|'media_voice'|'media_image'|'media_video'} ProviderCategory
 * @typedef {'apiKey'|'authToken'} AuthMode
 * @typedef {{
 *   id: string,
 *   label: string,
 *   category: ProviderCategory,
 *   baseUrl: string,
 *   keyPrefix: string,
 *   keyHint: string,
 *   signup: string,
 *   authMode?: AuthMode,
 *   models: ModelDef[],
 *   defaultModel?: string,
 *   custom?: boolean,
 *   anyModel?: boolean,
 *   apiFormat?: 'tovyr'|'openai',
 *   featured?: boolean,
 *   regions?: string[],
 *   notes?: string,
 * }} ProviderDef
 */

import { EXTRA_PROVIDER_CATALOG } from './tovyr-provider-catalog-extra.js'
import { PROVIDER_MODEL_EXPANSIONS } from './tovyr-provider-models-expanded.js'

const TIER_RANK = { opus: 0, sonnet: 1, haiku: 2 }

const CATEGORY_ORDER = [
  'direct',
  'gateway',
  'api',
  'regional',
  'cloud',
  'self_hosted',
  'media_voice',
  'media_image',
  'media_video',
]

/** @param {ModelDef[]} models */
export function sortModelsBestToWorst(models) {
  return [...models].sort((a, b) => {
    const ra = TIER_RANK[a.tier] ?? 1
    const rb = TIER_RANK[b.tier] ?? 1
    if (ra !== rb) return ra - rb
    return a.label.localeCompare(b.label)
  })
}

/** @param {ProviderDef|null|undefined} provider */
export function getDefaultModelId(provider) {
  if (!provider) return ''
  if (provider.defaultModel) {
    const listed = provider.models?.some(m => m.id === provider.defaultModel)
    if (listed || provider.anyModel) return provider.defaultModel
  }
  return sortModelsBestToWorst(provider.models || [])[0]?.id || ''
}

/** @param {ProviderDef|null|undefined} provider @param {string} modelId */
export function isCatalogModel(provider, modelId) {
  if (!modelId || !provider) return false
  if (provider.anyModel) return true
  if (!provider.models?.length) return provider.custom === true
  return provider.models.some(m => m.id === modelId)
}

/** @type {Record<string, ProviderDef>} */
export const PROVIDER_CATALOG = {
  // ── Official / bundled ──────────────────────────────────────────────
  freemodel: {
    id: 'freemodel',
    label: 'FreeModel',
    category: 'direct',
    baseUrl: 'https://cc.freemodel.dev',
    keyPrefix: 'fe_oa_',
    keyHint: 'fe_oa_...',
    signup: 'https://freemodel.dev',
    defaultModel: 'claude-opus-4-8',
    models: [
      { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'opus' },
      { id: 'claude-opus-4-7', label: 'Opus 4.7', tier: 'opus' },
      { id: 'claude-opus-4-6', label: 'Opus 4.6', tier: 'opus' },
      { id: 'claude-opus-4-5-20251101', label: 'Opus 4.5', tier: 'opus' },
      { id: 'claude-opus-4-1-20250805', label: 'Opus 4.1', tier: 'opus' },
      { id: 'claude-sonnet-5', label: 'Sonnet 5', tier: 'sonnet' },
      { id: 'claude-sonnet', label: 'Sonnet 4.6', tier: 'sonnet' },
      { id: 'claude-sonnet-20250929', label: 'Sonnet 4.5', tier: 'sonnet' },
      { id: 'claude-sonnet-4-20250514', label: 'Sonnet 4', tier: 'sonnet' },
      { id: 'claude-fable-5', label: 'Fable 5', tier: 'opus' },
      { id: 'claude-mythos-5', label: 'Mythos 5', tier: 'opus' },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', tier: 'haiku' },
      { id: 'claude-3-5-haiku-20241022', label: 'Haiku 3.5', tier: 'haiku' }
    ],
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    category: 'direct',
    baseUrl: 'https://api.anthropic.com',
    keyPrefix: 'sk-ant-',
    keyHint: 'sk-ant-...',
    signup: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-sonnet-5',
    models: [
      { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'opus' },
      { id: 'claude-opus-4-7', label: 'Opus 4.7', tier: 'opus' },
      { id: 'claude-opus-4-6', label: 'Opus 4.6', tier: 'opus' },
      { id: 'claude-opus-4-5-20251101', label: 'Opus 4.5', tier: 'opus' },
      { id: 'claude-opus-4-1-20250805', label: 'Opus 4.1', tier: 'opus' },
      { id: 'claude-sonnet-5', label: 'Sonnet 5', tier: 'sonnet' },
      { id: 'claude-sonnet', label: 'Sonnet 4.6', tier: 'sonnet' },
      { id: 'claude-sonnet-20250929', label: 'Sonnet 4.5', tier: 'sonnet' },
      { id: 'claude-sonnet-4-20250514', label: 'Sonnet 4', tier: 'sonnet' },
      { id: 'claude-fable-5', label: 'Fable 5', tier: 'opus' },
      { id: 'claude-mythos-5', label: 'Mythos 5', tier: 'opus' },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', tier: 'haiku' },
      { id: 'claude-3-5-haiku-20241022', label: 'Haiku 3.5', tier: 'haiku' }
    ],
  },

  // ── Multi-model gateways ────────────────────────────────────────────
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    category: 'gateway',
    baseUrl: 'https://openrouter.ai/api',
    keyPrefix: 'sk-or-',
    keyHint: 'sk-or-v1-...',
    signup: 'https://openrouter.ai/keys',
    authMode: 'authToken',
    anyModel: true,
    featured: true,
    regions: ['global'],
    notes: 'Tovyr, GPT, Gemini, Llama, DeepSeek, and 400+ models — any model id works',
    defaultModel: 'anthropic/claude-sonnet-5',
    models: [
      { id: 'anthropic/claude-opus-4-8', label: 'Tovyr Opus 4.8', tier: 'opus' },
      { id: 'anthropic/claude-opus-4-7', label: 'Tovyr Opus 4.7', tier: 'opus' },
      { id: 'anthropic/claude-sonnet-5', label: 'Tovyr Sonnet 5', tier: 'sonnet' },
      { id: 'anthropic/claude-sonnet', label: 'Tovyr Sonnet 4.6', tier: 'sonnet' },
      { id: 'anthropic/claude-fable-5', label: 'Tovyr Fable 5', tier: 'opus' },
      { id: 'anthropic/claude-mythos-5', label: 'Tovyr Mythos 5', tier: 'opus' },
      { id: 'anthropic/claude-haiku-4-5', label: 'Tovyr Haiku 4.5', tier: 'haiku' },
      { id: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol', tier: 'opus' },
      { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', tier: 'sonnet' },
      { id: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', tier: 'haiku' },
      { id: 'openai/gpt-5.5', label: 'GPT-5.5', tier: 'opus' },
      { id: 'openai/gpt-4o', label: 'GPT-4o', tier: 'sonnet' },
      { id: 'openai/gpt-4.1', label: 'GPT-4.1', tier: 'sonnet' },
      { id: 'openai/o3', label: 'o3', tier: 'opus' },
      { id: 'openai/o4-mini', label: 'o4-mini', tier: 'sonnet' },
      { id: 'openai/o3-mini', label: 'o3-mini', tier: 'sonnet' },
      { id: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash', tier: 'sonnet' },
      { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', tier: 'opus' },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', tier: 'opus' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'haiku' },
      { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', tier: 'opus' },
      { id: 'x-ai/grok-4.5', label: 'Grok 4.5', tier: 'opus' },
      { id: 'x-ai/grok-4', label: 'Grok 4', tier: 'opus' },
      { id: 'x-ai/grok-3.5', label: 'Grok 3.5', tier: 'sonnet' },
      { id: 'moonshotai/kimi-k3', label: 'Kimi K3', tier: 'sonnet' },
      { id: 'moonshotai/kimi-k2.7-code', label: 'Kimi K2.7 Code', tier: 'sonnet' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', tier: 'sonnet', context: '128k' },
      { id: 'meta-llama/llama-4-scout-17b-16e', label: 'Llama 4 Scout', tier: 'sonnet', context: '128k' },
      { id: 'mistralai/mistral-large', label: 'Mistral Large', tier: 'opus' },
      { id: 'mistralai/codestral-latest', label: 'Codestral', tier: 'sonnet' },
      { id: 'cohere/command-r-plus', label: 'Command R+', tier: 'sonnet' },
      { id: 'perplexity/sonar-pro', label: 'Sonar Pro', tier: 'sonnet' }
    ],
  },
  huggingface: {
    id: 'huggingface',
    label: 'Hugging Face',
    category: 'gateway',
    baseUrl: 'https://router.huggingface.co',
    keyPrefix: 'hf_',
    keyHint: 'hf_...',
    signup: 'https://huggingface.co/settings/tokens',
    authMode: 'authToken',
    anyModel: true,
    notes: 'Inference Providers — any open model id via HF router',
    models: [
      { id: 'zai-org/GLM-5.1', label: 'GLM 5.1', tier: 'sonnet' },
      { id: 'zai-org/GLM-5', label: 'GLM-5', tier: 'opus' },
      { id: 'MiniMaxAI/MiniMax-M3', label: 'MiniMax M3', tier: 'opus' },
      { id: 'MiniMaxAI/MiniMax-M2.7', label: 'MiniMax M2.7', tier: 'sonnet' },
      { id: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B', tier: 'opus' },
      { id: 'Qwen/Qwen3-Coder-Next', label: 'Qwen3 Coder', tier: 'sonnet' },
      { id: 'moonshotai/Kimi-K3-Instruct', label: 'Kimi K3', tier: 'sonnet' },
      { id: 'moonshotai/Kimi-K2.7-Code', label: 'Kimi K2.7 Code', tier: 'sonnet' },
      { id: 'moonshotai/Kimi-K2-Instruct-0905', label: 'Kimi K2', tier: 'sonnet' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', tier: 'sonnet' },
      { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', label: 'Llama 4 Scout', tier: 'sonnet' },
      { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B', tier: 'haiku' },
      { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
      { id: 'mistralai/Mistral-Large-Instruct-2411', label: 'Mistral Large', tier: 'opus' },
      { id: 'google/gemma-2-27b-it', label: 'Gemma 2 27B', tier: 'sonnet' }
    ],
  },

  // ── Direct API providers (Tovyr-compatible) ─────────────────────
  zai: {
    id: 'zai',
    label: 'Z.AI (GLM)',
    category: 'api',
    baseUrl: 'https://api.z.ai/api/anthropic',
    keyPrefix: '',
    keyHint: 'Z.AI API key',
    signup: 'https://z.ai/manage-apikey/apikey-list',
    authMode: 'authToken',
    defaultModel: 'glm-5',
    models: [
      { id: 'glm-5', label: 'GLM-5', tier: 'opus' },
      { id: 'glm-5.1', label: 'GLM 5.1', tier: 'sonnet' },
      { id: 'glm-4.6', label: 'GLM-4.6', tier: 'sonnet' },
      { id: 'glm-4.5-air', label: 'GLM-4.5 Air', tier: 'haiku' },
      { id: 'glm-4-plus', label: 'GLM-4 Plus', tier: 'sonnet' },
      { id: 'glm-4-flash', label: 'GLM-4 Flash', tier: 'haiku' }
    ],
  },
  moonshot: {
    id: 'moonshot',
    label: 'Moonshot (Kimi)',
    category: 'api',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    keyPrefix: 'sk-',
    keyHint: 'sk-...',
    signup: 'https://platform.moonshot.ai/console/api-keys',
    authMode: 'authToken',
    notes: 'Open Platform API key — uses Bearer auth. Kimi For Coding subscription keys: use kimi_coding provider.',
    defaultModel: 'kimi-k3',
    models: [
      { id: 'kimi-k3', label: 'Kimi K3', tier: 'opus' },
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', tier: 'sonnet' },
      { id: 'kimi-k2.7-code-highspeed', label: 'Kimi K2.7 Code Highspeed', tier: 'sonnet' },
      { id: 'kimi-k2.6', label: 'Kimi K2.6', tier: 'sonnet' },
      { id: 'kimi-k2.5', label: 'Kimi K2.5', tier: 'haiku' }
    ],
  },
  moonshot_cn: {
    id: 'moonshot_cn',
    label: 'Moonshot China (Kimi)',
    category: 'china',
    baseUrl: 'https://api.moonshot.cn/anthropic',
    keyPrefix: 'sk-',
    keyHint: 'sk-...',
    signup: 'https://platform.moonshot.cn/console/api-keys',
    authMode: 'authToken',
    defaultModel: 'kimi-k3',
    models: [
      { id: 'kimi-k3', label: 'Kimi K3', tier: 'opus' },
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', tier: 'sonnet' },
      { id: 'kimi-k2.7-code-highspeed', label: 'Kimi K2.7 Code Highspeed', tier: 'sonnet' },
      { id: 'kimi-k2.6', label: 'Kimi K2.6', tier: 'sonnet' },
      { id: 'kimi-k2.5', label: 'Kimi K2.5', tier: 'haiku' }
    ],
  },
  kimi_coding: {
    id: 'kimi_coding',
    label: 'Kimi For Coding',
    category: 'api',
    baseUrl: 'https://api.kimi.com/coding',
    keyPrefix: 'sk-',
    keyHint: 'sk-kimi-...',
    signup: 'https://www.kimi.com/code',
    authMode: 'apiKey',
    notes: 'Membership API key from kimi.com/code — not the Open Platform key',
    defaultModel: 'kimi-k2.7-code',
    models: [
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', tier: 'sonnet' },
      { id: 'kimi-k2.7-code-highspeed', label: 'Kimi K2.7 Code Highspeed', tier: 'sonnet' },
      { id: 'kimi-k3', label: 'Kimi K3', tier: 'opus' }
    ],
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    category: 'api',
    baseUrl: 'https://api.deepseek.com/anthropic',
    keyPrefix: 'sk-',
    keyHint: 'sk-...',
    signup: 'https://platform.deepseek.com/api_keys',
    authMode: 'authToken',
    defaultModel: 'deepseek-v4-pro',
    models: [
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
      { id: 'deepseek-v3', label: 'DeepSeek V3', tier: 'sonnet' },
      { id: 'deepseek-r1', label: 'DeepSeek R1', tier: 'opus' }
    ],
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    category: 'api',
    baseUrl: 'https://api.minimax.io/anthropic',
    keyPrefix: '',
    keyHint: 'MiniMax API key',
    signup: 'https://platform.minimax.io/user-center/basic-information',
    authMode: 'authToken',
    defaultModel: 'MiniMax-M3',
    models: [
      { id: 'MiniMax-M3', label: 'MiniMax M3', tier: 'opus' },
      { id: 'MiniMax-M2.7', label: 'MiniMax M2.7', tier: 'sonnet' },
      { id: 'MiniMax-M2.5', label: 'MiniMax M2.5', tier: 'haiku' }
    ],
  },
  minimax_cn: {
    id: 'minimax_cn',
    label: 'MiniMax (China)',
    category: 'china',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    keyPrefix: '',
    keyHint: 'MiniMax API key',
    signup: 'https://platform.minimaxi.com',
    authMode: 'authToken',
    models: [
      { id: 'MiniMax-M3', label: 'MiniMax M3', tier: 'opus' },
      { id: 'MiniMax-M2.7', label: 'MiniMax M2.7', tier: 'sonnet' },
      { id: 'MiniMax-M2.5', label: 'MiniMax M2.5', tier: 'haiku' }
    ],
  },
  fireworks: {
    id: 'fireworks',
    label: 'Fireworks AI',
    category: 'api',
    baseUrl: 'https://api.fireworks.ai/inference',
    keyPrefix: '',
    keyHint: 'fw_... or fpk_...',
    signup: 'https://app.fireworks.ai/settings/users/api-keys',
    models: [
      { id: 'accounts/fireworks/routers/kimi-k3', label: 'Kimi K3', tier: 'opus' },
      { id: 'accounts/fireworks/routers/kimi-k2p7-code-fast', label: 'Kimi K2.7 Code', tier: 'sonnet', context: '256k' },
      { id: 'accounts/fireworks/models/glm-5p1', label: 'GLM 5.1', tier: 'sonnet' },
      { id: 'accounts/fireworks/models/deepseek-v4', label: 'DeepSeek V4', tier: 'sonnet' },
      { id: 'accounts/fireworks/models/minimax-m3', label: 'MiniMax M3', tier: 'opus' },
      { id: 'accounts/fireworks/models/minimax-m2p5', label: 'MiniMax M2.5', tier: 'haiku' }
    ],
  },
  novita: {
    id: 'novita',
    label: 'Novita AI',
    category: 'api',
    baseUrl: 'https://api.novita.ai/anthropic',
    keyPrefix: '',
    keyHint: 'Novita API key',
    signup: 'https://novita.ai/settings/key-management',
    authMode: 'authToken',
    models: [
      { id: 'moonshotai/kimi-k3', label: 'Kimi K3', tier: 'sonnet' },
      { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'anthropic/claude-sonnet-5', label: 'Tovyr Sonnet 5', tier: 'sonnet' },
      { id: 'anthropic/claude-opus-4-8', label: 'Tovyr Opus 4.8', tier: 'opus' },
      { id: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol', tier: 'opus' },
      { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', tier: 'sonnet' },
      { id: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash', tier: 'sonnet' }
    ],
  },
  siliconflow: {
    id: 'siliconflow',
    label: 'SiliconFlow',
    category: 'api',
    baseUrl: 'https://api.siliconflow.com',
    keyPrefix: 'sk-',
    keyHint: 'sk-...',
    signup: 'https://cloud.siliconflow.com/account/ak',
    models: [
      { id: 'zai-org/GLM-5.1', label: 'GLM 5.1', tier: 'sonnet' },
      { id: 'MiniMaxAI/MiniMax-M3', label: 'MiniMax M3', tier: 'opus' },
      { id: 'MiniMaxAI/MiniMax-M2.7', label: 'MiniMax M2.7', tier: 'sonnet' },
      { id: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B', tier: 'opus' },
      { id: 'Qwen/Qwen3-Coder-Next', label: 'Qwen3 Coder', tier: 'sonnet' },
      { id: 'moonshotai/Kimi-K3-Instruct', label: 'Kimi K3', tier: 'sonnet' },
      { id: 'moonshotai/Kimi-K2.7-Code', label: 'Kimi K2.7 Code', tier: 'sonnet' },
      { id: 'moonshotai/Kimi-K2-Instruct-0905', label: 'Kimi K2', tier: 'sonnet' },
      { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', tier: 'sonnet' },
      { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B', tier: 'haiku' }
    ],
  },
  siliconflow_cn: {
    id: 'siliconflow_cn',
    label: 'SiliconFlow (China)',
    category: 'china',
    baseUrl: 'https://api.siliconflow.cn',
    keyPrefix: 'sk-',
    keyHint: 'sk-...',
    signup: 'https://cloud.siliconflow.cn/account/ak',
    models: [
      { id: 'zai-org/GLM-5.1', label: 'GLM 5.1', tier: 'sonnet' },
      { id: 'MiniMaxAI/MiniMax-M3', label: 'MiniMax M3', tier: 'opus' },
      { id: 'MiniMaxAI/MiniMax-M2.7', label: 'MiniMax M2.7', tier: 'sonnet' },
      { id: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B', tier: 'opus' },
      { id: 'Qwen/Qwen3-Coder-Next', label: 'Qwen3 Coder', tier: 'sonnet' },
      { id: 'moonshotai/Kimi-K3-Instruct', label: 'Kimi K3', tier: 'sonnet' },
      { id: 'moonshotai/Kimi-K2.7-Code', label: 'Kimi K2.7 Code', tier: 'sonnet' },
      { id: 'moonshotai/Kimi-K2-Instruct-0905', label: 'Kimi K2', tier: 'sonnet' },
      { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', tier: 'sonnet' },
      { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B', tier: 'haiku' }
    ],
  },
  dashscope: {
    id: 'dashscope',
    label: 'Alibaba DashScope (Qwen)',
    category: 'api',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/apps/anthropic',
    keyPrefix: 'sk-',
    keyHint: 'sk-... (DashScope)',
    signup: 'https://dashscope.console.aliyun.com/apiKey',
    authMode: 'authToken',
    notes: 'International region — use dashscope_cn for China',
    models: [
      { id: 'qwen-max', label: 'Qwen Max', tier: 'opus' },
      { id: 'qwen3-235b-a22b', label: 'Qwen3 235B', tier: 'opus' },
      { id: 'qwen-plus', label: 'Qwen Plus', tier: 'sonnet' },
      { id: 'qwen-turbo', label: 'Qwen Turbo', tier: 'haiku' }
    ],
  },
  dashscope_cn: {
    id: 'dashscope_cn',
    label: 'DashScope China (Qwen)',
    category: 'china',
    baseUrl: 'https://dashscope.aliyuncs.com/apps/anthropic',
    keyPrefix: 'sk-',
    keyHint: 'sk-... (DashScope CN)',
    signup: 'https://dashscope.console.aliyun.com/apiKey',
    authMode: 'authToken',
    models: [
      { id: 'qwen-max', label: 'Qwen Max', tier: 'opus' },
      { id: 'qwen3-235b-a22b', label: 'Qwen3 235B', tier: 'opus' },
      { id: 'qwen-plus', label: 'Qwen Plus', tier: 'sonnet' },
      { id: 'qwen-turbo', label: 'Qwen Turbo', tier: 'haiku' }
    ],
  },
  modelscope: {
    id: 'modelscope',
    label: 'ModelScope',
    category: 'china',
    baseUrl: 'https://api-inference.modelscope.cn',
    keyPrefix: 'ms-',
    keyHint: 'ms-...',
    signup: 'https://modelscope.cn/my/myaccesstoken',
    notes: 'Beta Tovyr compat — use Qwen/GLM model IDs from ModelScope',
    models: [
      { id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', label: 'Qwen3 Coder', tier: 'sonnet' },
      { id: 'Qwen/Qwen3-235B-A22B-Instruct', label: 'Qwen3 235B', tier: 'opus' },
      { id: 'ZhipuAI/GLM-5', label: 'GLM-5', tier: 'opus' },
      { id: 'ZhipuAI/GLM-4.5', label: 'GLM 4.5', tier: 'sonnet' },
      { id: 'MiniMaxAI/MiniMax-M3', label: 'MiniMax M3', tier: 'opus' },
      { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' }
    ],
  },
  portkey: {
    id: 'portkey',
    label: 'Portkey AI Gateway',
    category: 'gateway',
    baseUrl: 'https://api.portkey.ai',
    keyPrefix: '',
    keyHint: 'Portkey API key',
    signup: 'https://app.portkey.ai/',
    authMode: 'authToken',
    anyModel: true,
    notes: '3000+ models — set x-portkey-provider via ANTHROPIC_CUSTOM_HEADERS',
    models: [
      { id: '@anthropic/claude-opus-4-8', label: 'Tovyr Opus 4.8', tier: 'opus' },
      { id: '@anthropic/claude-opus-4-7', label: 'Tovyr Opus 4.7', tier: 'opus' },
      { id: '@anthropic/claude-sonnet-5', label: 'Tovyr Sonnet 5', tier: 'sonnet' },
      { id: '@anthropic/claude-sonnet', label: 'Tovyr Sonnet 4.6', tier: 'sonnet' },
      { id: '@anthropic/claude-haiku-4-5', label: 'Tovyr Haiku 4.5', tier: 'haiku' },
      { id: '@openai/gpt-5.6-sol', label: 'GPT-5.6 Sol', tier: 'opus' },
      { id: '@openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', tier: 'sonnet' },
      { id: '@openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', tier: 'haiku' },
      { id: '@openai/o3', label: 'o3', tier: 'opus' },
      { id: '@openai/o4-mini', label: 'o4-mini', tier: 'sonnet' },
      { id: '@google/gemini-3.6-flash', label: 'Gemini 3.6 Flash', tier: 'sonnet' },
      { id: '@google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', tier: 'opus' },
      { id: '@deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: '@deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' }
    ],
  },
  aimlapi: {
    id: 'aimlapi',
    label: 'AIMLAPI',
    category: 'gateway',
    baseUrl: 'https://api.aimlapi.com',
    keyPrefix: '',
    keyHint: 'AIMLAPI key',
    signup: 'https://aimlapi.com',
    authMode: 'authToken',
    models: [
      { id: 'claude-opus-4-8', label: 'Tovyr Opus 4.8', tier: 'opus' },
      { id: 'claude-opus-4-7', label: 'Tovyr Opus 4.7', tier: 'opus' },
      { id: 'claude-sonnet-5', label: 'Tovyr Sonnet 5', tier: 'sonnet' },
      { id: 'claude-sonnet', label: 'Tovyr Sonnet 4.6', tier: 'sonnet' },
      { id: 'claude-haiku-4-5', label: 'Tovyr Haiku 4.5', tier: 'haiku' },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', tier: 'opus' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', tier: 'sonnet' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', tier: 'haiku' },
      { id: 'o3', label: 'o3', tier: 'opus' },
      { id: 'o4-mini', label: 'o4-mini', tier: 'sonnet' },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', tier: 'sonnet' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', tier: 'opus' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
      { id: 'kimi-k3', label: 'Kimi K3', tier: 'opus' },
      { id: 'grok-4.5', label: 'Grok 4.5', tier: 'opus' }
    ],anyModel: true,
    notes: 'Claude models via AIMLAPI — any AIMLAPI model id works',
  },
  chutes: {
    id: 'chutes',
    label: 'Chutes.ai',
    category: 'gateway',
    baseUrl: 'https://claude.chutes.ai',
    keyPrefix: 'cpk_',
    keyHint: 'cpk_...',
    signup: 'https://chutes.ai',
    authMode: 'authToken',
    models: [
      { id: 'zai-org/GLM-4.5-Air', label: 'GLM 4.5 Air', tier: 'haiku' },
      { id: 'zai-org/GLM-5.1', label: 'GLM 5.1', tier: 'sonnet' },
      { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', tier: 'sonnet' }
    ],
  },
  llmrouter: {
    id: 'llmrouter',
    label: 'LLM Router',
    category: 'gateway',
    baseUrl: 'https://api.llmrouter.app/v1',
    keyPrefix: 'sk-router-',
    keyHint: 'sk-router-...',
    signup: 'https://llmrouter.app',
    authMode: 'authToken',
    models: [
      { id: 'anthropic/claude-opus-4-8', label: 'Tovyr Opus 4.8', tier: 'opus' },
      { id: 'anthropic/claude-sonnet-5', label: 'Tovyr Sonnet 5', tier: 'sonnet' },
      { id: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol', tier: 'opus' },
      { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', tier: 'sonnet' },
      { id: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', tier: 'haiku' },
      { id: 'openai/o3', label: 'o3', tier: 'opus' },
      { id: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash', tier: 'sonnet' },
      { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', tier: 'opus' },
      { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
      { id: 'x-ai/grok-4.5', label: 'Grok 4.5', tier: 'opus' },
      { id: 'moonshotai/kimi-k3', label: 'Kimi K3', tier: 'sonnet' }
    ],
  },
  baseten: {
    id: 'baseten',
    label: 'Baseten',
    category: 'cloud',
    baseUrl: 'https://inference.baseten.co',
    keyPrefix: '',
    keyHint: 'Baseten API key',
    signup: 'https://app.baseten.co/settings/api_keys',
    authMode: 'authToken',
    models: [
      { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
      { id: 'zai-org/GLM-4.5-Air', label: 'GLM 4.5 Air', tier: 'haiku' },
      { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3', tier: 'sonnet' }
    ],notes: 'Tovyr Messages API (beta) — use Baseten model slugs',
  },

  // ── Self-hosted / custom gateways ───────────────────────────────────
  litellm: {
    id: 'litellm',
    label: 'LiteLLM Gateway',
    category: 'self_hosted',
    baseUrl: 'http://localhost:4000',
    keyPrefix: 'sk-',
    keyHint: 'LiteLLM master key',
    signup: 'https://docs.litellm.ai/docs/',
    custom: true,
    notes: 'Point at your LiteLLM proxy — supports OpenAI, Tovyr, Azure, etc.',
    models: [],
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    category: 'self_hosted',
    baseUrl: 'http://127.0.0.1:11434/v1',
    keyPrefix: '',
    keyHint: 'optional (local)',
    signup: 'https://ollama.com',
    apiFormat: 'openai',
    anyModel: true,
    defaultModel: 'qwen2.5-coder:1.5b',
    notes:
      'Free local mode. No login or API key. Run: ollama serve · ollama pull qwen2.5-coder:1.5b.',
    models: [
      {
        id: 'qwen2.5-coder:1.5b',
        label: 'Qwen 2.5 Coder 1.5B (local)',
        tier: 'local',
      },
    ],
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio',
    category: 'self_hosted',
    baseUrl: 'http://127.0.0.1:1234/v1',
    keyPrefix: '',
    keyHint: 'optional (local)',
    signup: 'https://lmstudio.ai',
    apiFormat: 'openai',
    anyModel: true,
    notes:
      'Local LM Studio OpenAI-compatible server. Start the local server in LM Studio, then pick a loaded model with /model.',
    models: [],
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    category: 'api',
    baseUrl: '',
    keyPrefix: 'sk-',
    keyHint: 'sk-... or gateway key',
    signup: 'https://platform.openai.com/api-keys',
    custom: true,
    anyModel: true,
    notes:
      'GPT via OpenRouter, Portkey, or LiteLLM. Native api.openai.com is OpenAI-format only.',
    defaultModel: 'openai/gpt-5.6-sol',
    models: [
      { id: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol', tier: 'opus' },
      { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', tier: 'sonnet' },
      { id: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', tier: 'haiku' },
      { id: 'openai/gpt-5.5', label: 'GPT-5.5', tier: 'opus' },
      { id: 'openai/gpt-4o', label: 'GPT-4o', tier: 'sonnet' },
      { id: 'openai/gpt-4.1', label: 'GPT-4.1', tier: 'sonnet' },
      { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', tier: 'haiku' },
      { id: 'openai/o3', label: 'o3', tier: 'opus' },
      { id: 'openai/o4-mini', label: 'o4-mini', tier: 'sonnet' },
      { id: 'openai/o3-mini', label: 'o3-mini', tier: 'sonnet' }
    ],
  },
  custom: {
    id: 'custom',
    label: 'Custom endpoint',
    category: 'self_hosted',
    baseUrl: '',
    keyPrefix: '',
    keyHint: 'API key',
    signup: '',
    custom: true,
    models: [],
    notes: 'Any Tovyr-compatible /v1/messages endpoint',
  },

  ...EXTRA_PROVIDER_CATALOG,
}

for (const [providerId, extraModels] of Object.entries(PROVIDER_MODEL_EXPANSIONS)) {
  const provider = PROVIDER_CATALOG[providerId]
  if (!provider || !extraModels?.length) continue
  const seen = new Set((provider.models || []).map(m => m.id))
  const merged = [...(provider.models || [])]
  for (const model of extraModels) {
    if (!seen.has(model.id)) {
      merged.push(model)
      seen.add(model.id)
    }
  }
  provider.models = merged
}

// Legacy id from older Tovyr builds
if (!PROVIDER_CATALOG.openai_proxy) {
  PROVIDER_CATALOG.openai_proxy = { ...PROVIDER_CATALOG.openai, id: 'openai_proxy', label: 'OpenAI (legacy id)' }
}

/** @type {Record<ProviderCategory, string>} */
export const PROVIDER_CATEGORIES = {
  direct: 'Model APIs',
  gateway: 'Multi-model routers',
  api: 'Compatible APIs',
  regional: 'Regional providers',
  cloud: 'Cloud / enterprise',
  self_hosted: 'Self-hosted',
  media_voice: 'Voice AI APIs',
  media_image: 'Image APIs',
  media_video: 'Video APIs',
}

/** @returns {boolean} */
export function isMediaProviderCategory(category) {
  return typeof category === 'string' && category.startsWith('media_')
}

/** Human-readable label for a catalog model id (any provider). */
export function lookupTovyrModelLabel(modelId) {
  if (!modelId) return null
  for (const provider of Object.values(PROVIDER_CATALOG)) {
    const hit = provider.models?.find(m => m.id === modelId)
    if (hit) return normalizeClaudeModelLabel(hit.label)
  }
  return null
}

/** Claude models keep Anthropic naming — never show "Tovyr Opus" etc. */
export function normalizeClaudeModelLabel(label) {
  if (!label || typeof label !== 'string') return label
  return label.replace(/^Tovyr (Opus|Sonnet|Haiku)\b/i, 'Claude $1')
}

/** Total curated models across the full provider catalog. */
export function countAllCatalogModels() {
  let total = 0
  for (const provider of Object.values(PROVIDER_CATALOG)) {
    if (provider.id === 'openai_proxy') continue
    total += provider.models?.length ?? 0
  }
  return total
}

/** Providers grouped by category for the /provider UI. */
export function listProvidersByCategory() {
  /** @type {Record<string, ProviderDef[]>} */
  const groups = {}
  for (const p of Object.values(PROVIDER_CATALOG)) {
    if (p.id === 'openai_proxy') continue
    const cat = p.category || 'api'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(p)
  }
  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      return a.label.localeCompare(b.label)
    })
  }
  return groups
}

/** Ordered categories with providers for the /provider picker. */
export function listProviderCategoriesOrdered() {
  const groups = listProvidersByCategory()
  /** @type {{ id: string, label: string, providers: ProviderDef[] }[]} */
  const ordered = []
  for (const id of CATEGORY_ORDER) {
    const providers = groups[id]
    if (providers?.length) {
      ordered.push({
        id,
        label: PROVIDER_CATEGORIES[id] || id,
        providers,
      })
    }
  }
  for (const [id, providers] of Object.entries(groups)) {
    if (!CATEGORY_ORDER.includes(id) && providers.length) {
      ordered.push({ id, label: PROVIDER_CATEGORIES[id] || id, providers })
    }
  }
  return ordered
}

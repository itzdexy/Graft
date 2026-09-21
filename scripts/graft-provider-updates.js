// Reviewed against the linked provider documentation on 2026-09-21.
// These are bootstrap choices, not claims that an account can run every model.
// Live model discovery replaces these lists whenever it succeeds.
const models = (...ids) => ids.map(id => ({ id, label: id, tier: 'sonnet' }))
const openai = (baseUrl, docs, extra = {}) => ({ baseUrl, apiFormat: 'openai', authMode: 'authToken', anyModel: true, notes: `OpenAI-compatible API. Live model availability depends on your account. ${docs}`, ...extra })

export const PROVIDER_UPDATES = {
  openrouter: openai('https://openrouter.ai/api/v1', 'https://openrouter.ai/docs/api_reference/overview'),
  openai: openai('https://api.openai.com/v1', 'https://developers.openai.com/api/docs/models', { defaultModel: 'gpt-5.6-terra', models: models('gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-4.1', 'gpt-4.1-mini') }),
  google: openai('https://generativelanguage.googleapis.com/v1beta/openai', 'https://ai.google.dev/gemini-api/docs/openai', { defaultModel: 'gemini-3.8-flash', models: models('gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash') }),
  groq: openai('https://api.groq.com/openai/v1', 'https://console.groq.com/docs/models', { defaultModel: 'openai/gpt-oss-120b', models: models('openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant') }),
  cerebras: openai('https://api.cerebras.ai/v1', 'https://inference-docs.cerebras.ai/models/overview', { defaultModel: 'gpt-oss-120b', models: models('gpt-oss-120b', 'qwen-3.8-27b') }),
  mistral: openai('https://api.mistral.ai/v1', 'https://docs.mistral.ai/api', { defaultModel: 'mistral-small-latest', models: models('mistral-large-latest', 'mistral-small-latest', 'codestral-latest') }),
  xai: openai('https://api.x.ai/v1', 'https://docs.x.ai/overview', { defaultModel: 'grok-4.6', models: models('grok-4.6') }),
  together: openai('https://api.together.ai/v1', 'https://docs.together.ai/docs/inference/openai-compatibility'),
  fireworks: openai('https://api.fireworks.ai/inference/v1', 'https://docs.fireworks.ai/tools-sdks/openai-compatibility'),
  huggingface: openai('https://router.huggingface.co/v1', 'https://huggingface.co/docs/inference-providers/tasks/chat-completion', { models: models('zai-org/GLM-5.3', 'deepseek-ai/DeepSeek-V4.1-Flash') }),
  sambanova: openai('https://api.sambanova.ai/v1', 'https://docs.sambanova.ai/docs/en/integrations/vscode'),
  nebius: openai('https://api.tokenfactory.nebius.com/v1', 'https://docs.tokenfactory.nebius.com/api-reference/examples/batches'),
  siliconflow_cn: openai('https://api.siliconflow.cn/v1', 'https://docs.siliconflow.cn/docs/userguide/quickstart'),
  baseten: openai('https://inference.baseten.co/v1', 'https://docs.baseten.co/inference/model-apis/overview'),
  github_models: { retired: 'GitHub Models retired on July 30, 2026. https://docs.github.com/en/github-models', models: [], defaultModel: '', notes: 'GitHub Models has retired. Use another provider; this is separate from GitHub Copilot.' },
  anthropic: { models: [
    { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', tier: 'opus', context: '1M' },
    { id: 'claude-opus-5', label: 'Claude Opus 5', tier: 'opus', context: '1M' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', tier: 'sonnet', context: '1M' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'haiku', context: '200k' },
  ], notes: 'Current bootstrap models: https://platform.claude.com/docs/en/models/overview. Use live discovery for all models available to your account.' },
}

export const NEW_PROVIDERS = {
  synthetic: { id: 'synthetic', label: 'Synthetic', category: 'api', keyPrefix: '', keyHint: 'Synthetic API key', signup: 'https://synthetic.new', ...openai('https://api.synthetic.new/openai/v1', 'https://dev.synthetic.new/docs/openai/chat-completions'), defaultModel: 'syn:large:text', models: models('syn:large:text') },
  nanogpt: { id: 'nanogpt', label: 'NanoGPT', category: 'gateway', keyPrefix: '', keyHint: 'NanoGPT API key', signup: 'https://nano-gpt.com', ...openai('https://nano-gpt.com/api/v1', 'https://docs.nano-gpt.com/api-reference/endpoint/chat-completion'), models: [] },
}

/**
 * Additional curated models merged into provider catalog entries at load time.
 * Gateways with anyModel: true still accept arbitrary ids via /model custom entry.
 */

/** @type {Record<string, Array<{ id: string, label: string, tier: 'opus'|'sonnet'|'haiku', context?: string }>>} */
export const PROVIDER_MODEL_EXPANSIONS = {
  meta: [
    { id: 'muse-spark-1.3', label: 'Muse Spark 1.3', tier: 'opus', context: '1M' },
    { id: 'muse-spark-1.3-contributor', label: 'Muse Spark 1.3 Contributor', tier: 'opus', context: '1M' },
    { id: 'muse-spark-1.2', label: 'Muse Spark 1.2', tier: 'sonnet', context: '1M' },
    { id: 'muse-spark-1.2-contributor', label: 'Muse Spark 1.2 Contributor', tier: 'sonnet', context: '1M' },
    { id: 'muse-spark-1.1', label: 'Muse Spark 1.1', tier: 'sonnet', context: '1M' }
  ],
  // NVIDIA NIM: model list comes from GET /v1/models at runtime (see catalogModels.ts).
  // Static guesses here caused 404s (e.g. mistralai/mistral-large, databricks/dbrx-instruct).
  nvidia_nim: [
    { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', tier: 'opus' },
    { id: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B Instruct', tier: 'sonnet' },
    { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B Instruct', tier: 'haiku' },
    { id: 'deepseek-ai/deepseek-r1', label: 'DeepSeek R1', tier: 'opus' },
    { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
    { id: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' }
  ],
  openrouter: [
    { id: 'anthropic/claude-opus-4-8', label: 'Claude Opus 4.8', tier: 'opus' },
    { id: 'anthropic/claude-opus-4-7', label: 'Claude Opus 4.7', tier: 'opus' },
    { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', tier: 'sonnet' },
    { id: 'anthropic/claude-sonnet', label: 'Claude Sonnet 4.6', tier: 'sonnet' },
    { id: 'anthropic/claude-fable-5', label: 'Claude Fable 5', tier: 'opus' },
    { id: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5', tier: 'haiku' },
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
    { id: 'meta-llama/llama-4-maverick-17b-128e', label: 'Llama 4 Maverick', tier: 'opus', context: '1M' },
    { id: 'meta-llama/llama-4-scout-17b-16e', label: 'Llama 4 Scout', tier: 'sonnet', context: '10M' },
    { id: 'mistralai/mistral-large', label: 'Mistral Large', tier: 'opus' },
    { id: 'mistralai/codestral-latest', label: 'Codestral', tier: 'sonnet' },
    { id: 'cohere/command-r-plus', label: 'Command R+', tier: 'sonnet' },
    { id: 'perplexity/sonar-pro', label: 'Sonar Pro', tier: 'sonnet' }
  ],
  huggingface: [
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
    { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct', label: 'Llama 4 Maverick', tier: 'opus' },
    { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', label: 'Llama 4 Scout', tier: 'sonnet' },
    { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B', tier: 'haiku' },
    { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
    { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
    { id: 'mistralai/Mistral-Large-Instruct-2411', label: 'Mistral Large', tier: 'opus' },
    { id: 'google/gemma-2-27b-it', label: 'Gemma 2 27B', tier: 'sonnet' }
  ],
  portkey: [
    { id: '@anthropic/claude-opus-4-8', label: 'Claude Opus 4.8', tier: 'opus' },
    { id: '@anthropic/claude-opus-4-7', label: 'Claude Opus 4.7', tier: 'opus' },
    { id: '@anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', tier: 'sonnet' },
    { id: '@anthropic/claude-sonnet', label: 'Claude Sonnet 4.6', tier: 'sonnet' },
    { id: '@anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5', tier: 'haiku' },
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
  aimlapi: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', tier: 'opus' },
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', tier: 'opus' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', tier: 'sonnet' },
    { id: 'claude-sonnet', label: 'Claude Sonnet 4.6', tier: 'sonnet' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', tier: 'haiku' },
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
  ],
  chutes: [
    { id: 'zai-org/GLM-4.5-Air', label: 'GLM 4.5 Air', tier: 'haiku' },
    { id: 'zai-org/GLM-5.1', label: 'GLM 5.1', tier: 'sonnet' },
    { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
    { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
    { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', tier: 'sonnet' }
  ],
  llmrouter: [
    { id: 'anthropic/claude-opus-4-8', label: 'Claude Opus 4.8', tier: 'opus' },
    { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', tier: 'sonnet' },
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
  novita: [
    { id: 'moonshotai/kimi-k3', label: 'Kimi K3', tier: 'sonnet' },
    { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
    { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', tier: 'sonnet' },
    { id: 'anthropic/claude-opus-4-8', label: 'Claude Opus 4.8', tier: 'opus' },
    { id: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol', tier: 'opus' },
    { id: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', tier: 'sonnet' },
    { id: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash', tier: 'sonnet' }
  ],
  siliconflow: [
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
  fireworks: [
    { id: 'accounts/fireworks/routers/kimi-k3', label: 'Kimi K3', tier: 'opus' },
    { id: 'accounts/fireworks/routers/kimi-k2p7-code-fast', label: 'Kimi K2.7 Code', tier: 'sonnet', context: '256k' },
    { id: 'accounts/fireworks/models/glm-5p1', label: 'GLM 5.1', tier: 'sonnet' },
    { id: 'accounts/fireworks/models/deepseek-v4', label: 'DeepSeek V4', tier: 'sonnet' },
    { id: 'accounts/fireworks/models/minimax-m3', label: 'MiniMax M3', tier: 'opus' },
    { id: 'accounts/fireworks/models/minimax-m2p5', label: 'MiniMax M2.5', tier: 'haiku' }
  ],
  together: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B', tier: 'sonnet' },
    { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-Turbo', label: 'Llama 4 Maverick', tier: 'opus' },
    { id: 'meta-llama/Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B', tier: 'haiku' },
    { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
    { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
    { id: 'moonshotai/Kimi-K3-Instruct', label: 'Kimi K3', tier: 'sonnet' }
  ],
  deepinfra: [
    { id: 'meta-llama/Meta-Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', tier: 'sonnet' },
    { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', label: 'Llama 3.1 70B', tier: 'sonnet' },
    { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro', tier: 'opus' },
    { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' },
    { id: 'moonshotai/Kimi-K3-Instruct', label: 'Kimi K3', tier: 'sonnet' }
  ],
  cerebras: [
    { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', tier: 'sonnet', context: '128k' },
    { id: 'llama-4-maverick-17b-128e', label: 'Llama 4 Maverick', tier: 'opus' },
    { id: 'llama-4-scout-17b-16e', label: 'Llama 4 Scout', tier: 'sonnet', context: '128k' },
    { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'sonnet' }
  ],
  github_models: [
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', tier: 'opus' },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', tier: 'sonnet' },
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', tier: 'haiku' },
    { id: 'gpt-5.5', label: 'GPT-5.5', tier: 'opus' },
    { id: 'gpt-4o', label: 'GPT-4o', tier: 'sonnet' },
    { id: 'gpt-4.1', label: 'GPT-4.1', tier: 'sonnet' },
    { id: 'o3', label: 'o3', tier: 'opus' },
    { id: 'o4-mini', label: 'o4-mini', tier: 'sonnet' },
    { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', tier: 'haiku' }
  ],
  groq: [
    { id: 'groq/llama-3.3-70b-versatile', label: 'Llama 3.3 70B', tier: 'sonnet', context: '128k' },
    { id: 'groq/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick', tier: 'opus' },
    { id: 'groq/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', tier: 'sonnet' },
    { id: 'groq/llama-3.1-8b-instant', label: 'Llama 3.1 8B', tier: 'haiku' },
    { id: 'groq/mixtral-8x7b-32768', label: 'Mixtral 8x7B', tier: 'haiku' }
  ],
  google: [
    { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', tier: 'opus' },
    { id: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash', tier: 'sonnet' },
    { id: 'google/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', tier: 'haiku' },
    { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', tier: 'opus' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'haiku' },
    { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', tier: 'haiku' }
  ],
  xai: [
    { id: 'grok-4.5', label: 'Grok 4.5', tier: 'opus' },
    { id: 'grok-4', label: 'Grok 4', tier: 'opus' },
    { id: 'grok-3.5', label: 'Grok 3.5', tier: 'sonnet' },
    { id: 'grok-3', label: 'Grok 3', tier: 'sonnet' },
    { id: 'grok-3-mini', label: 'Grok 3 Mini', tier: 'haiku' }
  ],
  mistral: [
    { id: 'mistral/mistral-large-latest', label: 'Mistral Large', tier: 'opus' },
    { id: 'mistral/mistral-small-latest', label: 'Mistral Small', tier: 'sonnet' },
    { id: 'mistral/codestral-latest', label: 'Codestral', tier: 'sonnet' }
  ],
  cohere: [
    { id: 'cohere/command-r-plus', label: 'Command R+', tier: 'sonnet' },
    { id: 'cohere/command-r', label: 'Command R', tier: 'haiku' }
  ],
  ai21: [
    { id: 'ai21/jamba-large', label: 'Jamba Large', tier: 'sonnet' },
    { id: 'ai21/jamba-mini', label: 'Jamba Mini', tier: 'haiku' }
  ],
}


/**
 * Additional curated models merged into provider catalog entries at load time.
 * Gateways with anyModel: true still accept arbitrary ids via /model custom entry.
 */

/** @type {Record<string, Array<{ id: string, label: string, tier: 'opus'|'sonnet'|'haiku', context?: string }>>} */
export const PROVIDER_MODEL_EXPANSIONS = {
  // NVIDIA NIM: model list comes from GET /v1/models at runtime (see catalogModels.ts).
  // Static guesses here caused 404s (e.g. mistralai/mistral-large, databricks/dbrx-instruct).
  nvidia_nim: [
    { id: 'meta/llama-3.2-90b-vision-instruct', label: 'Llama 3.2 90B Vision', tier: 'opus', context: '32k' },
    { id: 'meta/llama-3.2-11b-vision-instruct', label: 'Llama 3.2 11B Vision', tier: 'sonnet', context: '32k' },
  ],
  openrouter: [
    { id: 'anthropic/claude-3-5-haiku', label: 'Claude 3.5 Haiku', tier: 'haiku' },
    { id: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', tier: 'sonnet' },
    { id: 'openai/gpt-4.1', label: 'GPT-4.1', tier: 'opus' },
    { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', tier: 'sonnet' },
    { id: 'openai/gpt-4.1-nano', label: 'GPT-4.1 Nano', tier: 'haiku' },
    { id: 'openai/o1', label: 'o1', tier: 'opus' },
    { id: 'openai/o1-mini', label: 'o1-mini', tier: 'sonnet' },
    { id: 'openai/o3', label: 'o3', tier: 'opus' },
    { id: 'google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash', tier: 'haiku' },
    { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', tier: 'haiku' },
    { id: 'google/gemini-pro-1.5', label: 'Gemini 1.5 Pro', tier: 'sonnet' },
    { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', tier: 'opus' },
    { id: 'deepseek/deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B', tier: 'sonnet' },
    { id: 'meta-llama/llama-3.1-405b-instruct', label: 'Llama 3.1 405B', tier: 'opus' },
    { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B', tier: 'sonnet' },
    { id: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B', tier: 'haiku' },
    { id: 'mistralai/mistral-large', label: 'Mistral Large', tier: 'opus' },
    { id: 'mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1', tier: 'sonnet' },
    { id: 'mistralai/codestral-latest', label: 'Codestral', tier: 'sonnet' },
    { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', tier: 'opus' },
    { id: 'qwen/qwen-2.5-coder-32b-instruct', label: 'Qwen 2.5 Coder 32B', tier: 'sonnet' },
    { id: 'x-ai/grok-3', label: 'Grok 3', tier: 'opus' },
    { id: 'x-ai/grok-3-mini', label: 'Grok 3 Mini', tier: 'haiku' },
    { id: 'cohere/command-r-plus', label: 'Command R+', tier: 'sonnet' },
    { id: 'perplexity/sonar-pro', label: 'Sonar Pro', tier: 'sonnet' },
    { id: 'moonshotai/kimi-k2', label: 'Kimi K2', tier: 'sonnet' },
    { id: 'moonshotai/kimi-k2-thinking', label: 'Kimi K2 Thinking', tier: 'opus' },
  ],
  huggingface: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', tier: 'opus' },
    { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B', tier: 'haiku' },
    { id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1', tier: 'opus' },
    { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3', tier: 'sonnet' },
    { id: 'mistralai/Mistral-Large-Instruct-2411', label: 'Mistral Large', tier: 'opus' },
    { id: 'google/gemma-2-27b-it', label: 'Gemma 2 27B', tier: 'sonnet' },
  ],
  portkey: [
    { id: 'anthropic/claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet', tier: 'sonnet' },
    { id: 'openai/gpt-4o', label: 'GPT-4o', tier: 'sonnet' },
    { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro', tier: 'opus' },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3', tier: 'sonnet' },
  ],
}

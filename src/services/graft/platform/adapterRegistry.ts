import type { ProviderAdapter } from './types.js'
import { openAiCompatibleAdapter } from './adapters/openAiCompatible.js'
import { anthropicCompatibleAdapter } from './adapters/anthropicCompatible.js'
export function adapterForProtocol(protocol: 'openai' | 'anthropic'): ProviderAdapter { return protocol === 'openai' ? openAiCompatibleAdapter : anthropicCompatibleAdapter }

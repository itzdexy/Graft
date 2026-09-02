export * from './speculative.js'
export * from './kvcache.js'
export * from './promptCache.js'
export * from './backends.js'
export * from './parallelism.js'

import { speculativeDecodingFromEnv } from './speculative.js'
import { kvCacheFromEnv } from './kvcache.js'
import { backendFromEnv } from './backends.js'
import { tensorParallelismFromEnv } from './parallelism.js'

/** Load all inference optimizations from environment. */
export function initInferenceFromEnv(): void {
  speculativeDecodingFromEnv()
  kvCacheFromEnv()
  backendFromEnv()
  tensorParallelismFromEnv()
}

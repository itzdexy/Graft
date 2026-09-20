/**
 * KV-cache quantization (llama.cpp: Q4_K, Q8_0, etc.).
 */

export type KvCacheQuantization =
  | 'f16'
  | 'q8_0'
  | 'q4_0'
  | 'q4_1'
  | 'q4_k'
  | 'q4_k_s'
  | 'q4_k_m'
  | 'q5_k'
  | 'q6_k'

export interface KvCacheConfig {
  quantization: KvCacheQuantization
  /** Offload KV cache layers to GPU (0 = CPU only). */
  gpuLayers: number
  /** Max context slots to cache. */
  maxSlots: number
}

const DEFAULT: KvCacheConfig = {
  quantization: 'q8_0',
  gpuLayers: -1,
  maxSlots: 1,
}

let active: KvCacheConfig = { ...DEFAULT }

export function getKvCacheConfig(): KvCacheConfig {
  return { ...active }
}

export function setKvCacheConfig(patch: Partial<KvCacheConfig>): KvCacheConfig {
  active = { ...active, ...patch }
  return getKvCacheConfig()
}

export function kvCacheFromEnv(): KvCacheConfig {
  const q = (process.env.GRAFT_KV_CACHE_QUANT ??
    process.env.LLAMA_CACHE_TYPE ??
    'q8_0') as KvCacheQuantization
  const gpuLayers = Number(process.env.GRAFT_KV_GPU_LAYERS ?? -1)
  return setKvCacheConfig({
    quantization: q,
    gpuLayers: Number.isFinite(gpuLayers) ? gpuLayers : -1,
  })
}

export function toLlamaCppCacheFlags(
  config: KvCacheConfig = active,
): Record<string, string | number> {
  return {
    'cache-type-k': config.quantization,
    'cache-type-v': config.quantization,
    'n-gpu-layers': config.gpuLayers,
  }
}

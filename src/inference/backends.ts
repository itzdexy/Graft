/**
 * Multi-backend inference support (Metal, CUDA, Vulkan, CPU — llama.cpp).
 */

export type InferenceBackend =
  | 'auto'
  | 'cpu'
  | 'cuda'
  | 'metal'
  | 'vulkan'
  | 'rocm'
  | 'sycl'

export interface BackendConfig {
  backend: InferenceBackend
  deviceId: number
  threads: number
  batchSize: number
}

const DEFAULT: BackendConfig = {
  backend: 'auto',
  deviceId: 0,
  threads: 0,
  batchSize: 512,
}

let active: BackendConfig = { ...DEFAULT }

export function getBackendConfig(): BackendConfig {
  return { ...active }
}

export function setBackendConfig(patch: Partial<BackendConfig>): BackendConfig {
  active = { ...active, ...patch }
  return getBackendConfig()
}

export function backendFromEnv(): BackendConfig {
  const backend = (process.env.TOVYR_INFERENCE_BACKEND ??
    process.env.LLAMA_BACKEND ??
    'auto') as InferenceBackend
  const threads = Number(process.env.TOVYR_INFERENCE_THREADS ?? 0)
  return setBackendConfig({
    backend,
    threads: Number.isFinite(threads) ? threads : 0,
  })
}

export function detectAvailableBackends(): InferenceBackend[] {
  const out: InferenceBackend[] = ['cpu']
  const platform = process.platform
  if (platform === 'darwin') out.push('metal')
  if (process.env.CUDA_VISIBLE_DEVICES !== undefined) out.push('cuda')
  if (process.env.ROCM_PATH) out.push('rocm')
  return out
}

export function toBackendFlags(
  config: BackendConfig = active,
): Record<string, string | number> {
  const flags: Record<string, string | number> = {}
  if (config.backend !== 'auto') {
    flags.backend = config.backend
  }
  if (config.threads > 0) flags.threads = config.threads
  if (config.batchSize > 0) flags['n-batch'] = config.batchSize
  return flags
}

/**
 * Tensor parallelism for multi-GPU inference (vLLM pattern).
 */

export interface TensorParallelismConfig {
  enabled: boolean
  /** Number of GPUs / ranks. */
  worldSize: number
  /** Pipeline parallel stages (optional). */
  pipelineStages: number
  /** Distributed backend. */
  backend: 'nccl' | 'gloo' | 'mpi'
}

const DEFAULT: TensorParallelismConfig = {
  enabled: false,
  worldSize: 1,
  pipelineStages: 1,
  backend: 'nccl',
}

let active: TensorParallelismConfig = { ...DEFAULT }

export function getTensorParallelismConfig(): TensorParallelismConfig {
  return { ...active }
}

export function setTensorParallelismConfig(
  patch: Partial<TensorParallelismConfig>,
): TensorParallelismConfig {
  active = { ...active, ...patch }
  return getTensorParallelismConfig()
}

export function tensorParallelismFromEnv(): TensorParallelismConfig {
  const tp = Number(process.env.GRAFT_TENSOR_PARALLEL ?? process.env.VLLM_TP ?? 1)
  const worldSize = Number.isFinite(tp) && tp > 1 ? tp : 1
  return setTensorParallelismConfig({
    enabled: worldSize > 1,
    worldSize,
  })
}

export function toVllmParallelFlags(
  config: TensorParallelismConfig = active,
): Record<string, number | boolean> {
  if (!config.enabled || config.worldSize <= 1) return {}
  return {
    tensor_parallel_size: config.worldSize,
    pipeline_parallel_size: config.pipelineStages,
  }
}

/** Omni-modality: vision + audio + text in one request (vLLM multimodal). */
export interface OmniModalityConfig {
  vision: boolean
  audio: boolean
  video: boolean
  maxImageTokens: number
}

let omni: OmniModalityConfig = {
  vision: true,
  audio: false,
  video: false,
  maxImageTokens: 4096,
}

export function getOmniModalityConfig(): OmniModalityConfig {
  return { ...omni }
}

export function setOmniModalityConfig(
  patch: Partial<OmniModalityConfig>,
): OmniModalityConfig {
  omni = { ...omni, ...patch }
  return getOmniModalityConfig()
}

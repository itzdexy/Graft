import os from 'os'
import { execSync } from 'child_process'

export type HardwareTier = 'small' | 'medium' | 'large' | 'workstation'

export type HardwareProfile = {
  platform: string
  cpuCores: number
  ramGb: number
  tier: HardwareTier
  gpuName: string | null
  vramGb: number | null
}

export type ModelRecommendation = {
  tier: HardwareTier
  cloud: string[]
  local: string[]
  deepResearch: string
  notes: string[]
}

const TIER_RAM_GB: Record<HardwareTier, number> = {
  small: 8,
  medium: 16,
  large: 32,
  workstation: 64,
}

export function classifyHardwareTier(ramGb: number): HardwareTier {
  if (ramGb < 8) return 'small'
  if (ramGb < 16) return 'medium'
  if (ramGb < 32) return 'large'
  return 'workstation'
}

function probeNvidiaGpu(): { name: string; vramGb: number } | null {
  try {
    const out = execSync(
      'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits',
      { encoding: 'utf8', timeout: 3000, windowsHide: true },
    ).trim()
    const line = out.split('\n')[0]
    if (!line) return null
    const [name, vramMb] = line.split(',').map(s => s.trim())
    if (!name || !vramMb) return null
    const vramGb = Math.round(Number(vramMb) / 1024)
    if (!Number.isFinite(vramGb)) return null
    return { name, vramGb }
  } catch {
    return null
  }
}

export function detectHardwareProfile(): HardwareProfile {
  const ramGb = Math.round(os.totalmem() / 1024 ** 3)
  const gpu = probeNvidiaGpu()
  return {
    platform: `${os.type()} ${os.release()}`,
    cpuCores: os.cpus().length,
    ramGb,
    tier: classifyHardwareTier(ramGb),
    gpuName: gpu?.name ?? null,
    vramGb: gpu?.vramGb ?? null,
  }
}

export function recommendModelsForHardware(profile: HardwareProfile): ModelRecommendation {
  const notes: string[] = [
    `${profile.cpuCores} CPU cores, ${profile.ramGb} GB RAM`,
    `Tier: ${profile.tier} (Odysseus Cookbook-style hardware fit)`,
  ]
  if (profile.gpuName) {
    notes.push(`GPU: ${profile.gpuName}${profile.vramGb ? ` (~${profile.vramGb} GB VRAM)` : ''}`)
  } else {
    notes.push('No NVIDIA GPU detected — local LLM serving will be CPU/RAM bound.')
  }

  const byTier: Record<HardwareTier, ModelRecommendation> = {
    small: {
      tier: 'small',
      cloud: ['haiku-tier / fast models in /model', 'NVIDIA NIM small models if configured'],
      local: ['7B Q4 GGUF via Ollama', 'Avoid deep-research loops on tiny context windows'],
      deepResearch: 'Use cloud API models; keep `/deep-research` to 3 rounds max.',
      notes,
    },
    medium: {
      tier: 'medium',
      cloud: ['sonnet-tier balanced models', 'Verified NIM / OpenAI-compat midsize models'],
      local: ['8B–14B Q4/Q5 GGUF', '13B max for comfortable CPU inference'],
      deepResearch: 'Cloud recommended; local OK for 8k+ context models with `/browser research` first.',
      notes,
    },
    large: {
      tier: 'large',
      cloud: ['sonnet or opus-tier for hard tasks', 'Cost-aware routing via /provider'],
      local: ['14B–32B Q4 with GPU', '70B only with ample VRAM'],
      deepResearch: 'Full `/deep-research` with 6 rounds — prefer 16k+ context.',
      notes,
    },
    workstation: {
      tier: 'workstation',
      cloud: ['opus-tier for architecture; haiku for subagents'],
      local: ['32B–70B with GPU offload', 'vLLM / llama.cpp multi-GPU if available'],
      deepResearch: 'Run full deep research locally or burst to cloud for synthesis.',
      notes,
    },
  }

  if (profile.vramGb != null && profile.vramGb < 8) {
    byTier[profile.tier].notes.push(
      'Low VRAM — prefer quantized models and cloud synthesis for `/deep-research` final report.',
    )
  }

  return byTier[profile.tier]
}

export function formatCookbookReport(): string {
  const profile = detectHardwareProfile()
  const rec = recommendModelsForHardware(profile)
  const minRam = TIER_RAM_GB[profile.tier]

  return [
    '# Tovyr Cookbook (hardware fit)',
    '',
    'Inspired by [Odysseus Cookbook](https://github.com/pewdiepie-archdaemon/odysseus) — model picks for **your** machine.',
    '',
    '## This machine',
    `- Platform: ${profile.platform}`,
    `- RAM: ${profile.ramGb} GB (tier **${profile.tier}**, ~${minRam} GB class)`,
    `- CPU cores: ${profile.cpuCores}`,
    profile.gpuName
      ? `- GPU: ${profile.gpuName}${profile.vramGb ? ` (${profile.vramGb} GB VRAM)` : ''}`
      : '- GPU: none detected (install NVIDIA drivers + `nvidia-smi` for VRAM probe)',
    '',
    '## Recommended cloud models (/model)',
    ...rec.cloud.map(c => `- ${c}`),
    '',
    '## Local / Ollama-style serving',
    ...rec.local.map(l => `- ${l}`),
    '',
    '## Deep research',
    `- ${rec.deepResearch}`,
    '',
    '## Notes',
    ...rec.notes.map(n => `- ${n}`),
    '',
    '## Next steps',
    '- `/provider list` — connect API keys',
    '- `/model` — pick a verified model for your tier',
    '- `/deep-research <question>` — multi-step research report',
    '- `/compare <question>` — blind A/B model test',
  ].join('\n')
}

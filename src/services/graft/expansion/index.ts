/**
 * World-class expansion feature hub — wires Goose, llama.cpp, vLLM, Aider,
 * Crush, OpenCode, OpenHands, Browser Use, Stagehand, and MCP server patterns.
 */

import { initInferenceFromEnv } from '../../../inference/index.js'
import { getRustHarnessStatus } from '../../../browser/rustHarness.js'
import { isAgentSdkReady } from '../../../agents/AgentSDK.js'
import { isAgentServerRunning } from '../../../agents/AgentServer.js'
import { getPromptCacheStats } from '../../../inference/promptCache.js'
import { getSpeculativeDecodingConfig } from '../../../inference/speculative.js'
import { getTensorParallelismConfig } from '../../../inference/parallelism.js'
import { loadCatalogSnapshot, isCatalogStale } from '../../../providers/autoUpdate.js'
import { formatCodeModeBanner } from '../../../codemode/context.js'
import { isGraftRuntime } from '../../../utils/graftRuntime.js'
import type { PermissionMode } from '../../../types/permissions.js'

export type ExpansionFeatureId =
  | 'adversary-agent'
  | 'code-mode'
  | 'speculative-decoding'
  | 'kv-cache-quant'
  | 'prompt-caching'
  | 'multi-backend'
  | 'tensor-parallelism'
  | 'omni-modality'
  | 'tree-sitter'
  | 'comment-tasks'
  | 'multimedia-context'
  | 'client-server'
  | 'provider-auto-update'
  | 'github-actions'
  | 'command-files'
  | 'bmad-workflow'
  | 'agent-sdk'
  | 'agent-server'
  | 'theory-of-mind'
  | 'rust-browser'
  | 'multilang-mcp'
  | 'sequential-thinking'
  | 'memory-graph'

export interface ExpansionFeatureStatus {
  id: ExpansionFeatureId
  name: string
  source: string
  status: 'active' | 'available' | 'configured' | 'stub'
  detail: string
}

let initialized = false

export function initExpansionFeatures(): void {
  if (initialized) return
  initInferenceFromEnv()
  initialized = true
}

export function getExpansionFeatureStatuses(
  opts?: { permissionMode?: PermissionMode; cwd?: string },
): ExpansionFeatureStatus[] {
  initExpansionFeatures()
  const catalog = loadCatalogSnapshot()
  const rust = getRustHarnessStatus()
  const promptCache = getPromptCacheStats()
  const spec = getSpeculativeDecodingConfig()
  const tp = getTensorParallelismConfig()
  const codeBanner = opts?.permissionMode
    ? formatCodeModeBanner(opts.permissionMode)
    : null

  return [
    {
      id: 'adversary-agent',
      name: 'Adversary Agent',
      source: 'Goose',
      status: 'available',
      detail: '/expansion adversary · /goose',
    },
    {
      id: 'code-mode',
      name: 'Code Mode',
      source: 'Goose',
      status: codeBanner ? 'active' : 'available',
      detail: codeBanner ?? '/code · auto-promote on implementation requests',
    },
    {
      id: 'speculative-decoding',
      name: 'Speculative Decoding',
      source: 'llama.cpp',
      status: spec.enabled ? 'active' : 'configured',
      detail: spec.enabled
        ? `draft=${spec.draftModel ?? 'default'} n=${spec.draftTokens}`
        : 'GRAFT_SPECULATIVE_DECODING=1',
    },
    {
      id: 'kv-cache-quant',
      name: 'KV-Cache Quantization',
      source: 'llama.cpp',
      status: 'configured',
      detail: 'GRAFT_KV_CACHE_QUANT · inference/kvcache.ts',
    },
    {
      id: 'prompt-caching',
      name: 'Prompt Caching',
      source: 'llama.cpp + API',
      status: promptCache.entries > 0 ? 'active' : 'configured',
      detail: `${promptCache.entries} local entries · API cache in services/api`,
    },
    {
      id: 'multi-backend',
      name: 'Multi-Backend',
      source: 'llama.cpp',
      status: 'configured',
      detail: 'GRAFT_INFERENCE_BACKEND=metal|cuda|cpu',
    },
    {
      id: 'tensor-parallelism',
      name: 'Tensor Parallelism',
      source: 'vLLM',
      status: tp.enabled ? 'active' : 'configured',
      detail: tp.enabled ? `worldSize=${tp.worldSize}` : 'GRAFT_TENSOR_PARALLEL',
    },
    {
      id: 'omni-modality',
      name: 'Omni-Modality',
      source: 'vLLM',
      status: 'active',
      detail: 'Image paste · attachments · vision models via /model',
    },
    {
      id: 'tree-sitter',
      name: 'Tree-Sitter Integration',
      source: 'Aider',
      status: 'active',
      detail: 'Bash tree-sitter + intelligence/treeSitter.ts symbols',
    },
    {
      id: 'comment-tasks',
      name: 'Comment Task Triggers',
      source: 'Aider',
      status: 'available',
      detail: '/expansion tasks · GRAFT/TODO comments',
    },
    {
      id: 'multimedia-context',
      name: 'Image/Web Context',
      source: 'Aider',
      status: 'active',
      detail: 'attachments.ts · context/multimedia.ts · WebFetch',
    },
    {
      id: 'client-server',
      name: 'Client-Server',
      source: 'Crush',
      status: 'active',
      detail: 'bridge/* · /rc remote control',
    },
    {
      id: 'provider-auto-update',
      name: 'Provider Auto-Updates',
      source: 'Crush',
      status: catalog ? (isCatalogStale(catalog) ? 'configured' : 'active') : 'configured',
      detail: '~/.graft/catalog-cache · /expansion catalog-refresh',
    },
    {
      id: 'github-actions',
      name: 'GitHub Actions',
      source: 'OpenCode',
      status: 'available',
      detail: '/install-github-app',
    },
    {
      id: 'command-files',
      name: 'Command Files with IDs',
      source: 'OpenCode',
      status: 'available',
      detail: '.graft/commands/*.md · /expansion commands',
    },
    {
      id: 'bmad-workflow',
      name: 'BMAD Workflow',
      source: 'OpenCode',
      status: 'available',
      detail: '/expansion bmad <goal> · run · next · status',
    },
    {
      id: 'agent-sdk',
      name: 'Software Agent SDK',
      source: 'OpenHands',
      status: isAgentSdkReady() ? 'active' : 'configured',
      detail: 'agents/AgentSDK.ts · entrypoints/sdk',
    },
    {
      id: 'agent-server',
      name: 'Agent Server',
      source: 'OpenHands',
      status: isAgentServerRunning() ? 'active' : 'available',
      detail: '/expansion serve',
    },
    {
      id: 'theory-of-mind',
      name: 'Theory-of-Mind',
      source: 'OpenHands',
      status: 'active',
      detail: 'Inferred goals · verbosity · skill level per session',
    },
    {
      id: 'rust-browser',
      name: 'Rust Browser Harness',
      source: 'Browser Use',
      status: rust.enabled && rust.binaryFound ? 'active' : 'configured',
      detail: rust.enabled
        ? rust.binaryFound
          ? 'native harness'
          : 'binary not built'
        : 'GRAFT_BROWSER_RUST=1',
    },
    {
      id: 'multilang-mcp',
      name: 'Multi-Language MCP',
      source: 'Stagehand',
      status: isGraftRuntime() ? 'active' : 'available',
      detail: '/expansion mcp-templates · mcp-install · TS/Python/uvx/Docker',
    },
    {
      id: 'sequential-thinking',
      name: 'Sequential Thinking',
      source: 'MCP Servers',
      status: isGraftRuntime() ? 'active' : 'available',
      detail: 'graft-sequential-thinking MCP · /expansion think',
    },
    {
      id: 'memory-graph',
      name: 'Memory Knowledge Graph',
      source: 'MCP Servers',
      status: isGraftRuntime() ? 'active' : 'available',
      detail: 'graft-memory MCP · .graft/memory-graph.json',
    },
  ]
}

export function formatExpansionStatusTable(
  opts?: { permissionMode?: PermissionMode },
): string {
  const rows = getExpansionFeatureStatuses(opts)
  const lines = [
    '# Graft expansion features',
    '',
    '| Feature | Source | Status |',
    '|---------|--------|--------|',
  ]
  for (const r of rows) {
    lines.push(`| ${r.name} | ${r.source} | ${r.status} — ${r.detail} |`)
  }
  lines.push(
    '',
    'Use `/expansion <subcommand>` — adversary, tasks, bmad, commands, think, catalog-refresh, serve, mcp-templates, mcp-install',
  )
  return lines.join('\n')
}

/**
 * Live extension capabilities. Keep this list to modules shipped in the
 * Tovyr source package: a status screen must never advertise an import hole.
 */
import { isAgentSdkReady } from '../../../agents/AgentSDK.js'
import { isAgentServerRunning } from '../../../agents/AgentServer.js'
import { isTovyrRuntime } from '../../../utils/tovyrRuntime.js'
import type { PermissionMode } from '../../../types/permissions.js'

export type ExpansionFeatureId =
  | 'code-mode'
  | 'agent-sdk'
  | 'agent-server'
  | 'multilang-mcp'
  | 'sequential-thinking'
  | 'memory-graph'

export interface ExpansionFeatureStatus {
  id: ExpansionFeatureId
  name: string
  source: string
  status: 'active' | 'available' | 'configured'
  detail: string
}

export function getExpansionFeatureStatuses(
  opts?: { permissionMode?: PermissionMode },
): ExpansionFeatureStatus[] {
  const codeMode = opts?.permissionMode === 'acceptEdits' || opts?.permissionMode === 'bypassPermissions'
  const runtime = isTovyrRuntime()
  return [
    {
      id: 'code-mode',
      name: 'Code Mode',
      source: 'Tovyr',
      status: codeMode ? 'active' : 'available',
      detail: codeMode ? 'Write/Edit enabled' : '/code enables implementation mode',
    },
    {
      id: 'agent-sdk',
      name: 'Software Agent SDK',
      source: 'Tovyr',
      status: isAgentSdkReady() ? 'active' : 'configured',
      detail: 'agents/AgentSDK.ts · entrypoints/sdk',
    },
    {
      id: 'agent-server',
      name: 'Agent Server',
      source: 'Tovyr',
      status: isAgentServerRunning() ? 'active' : 'available',
      detail: '/expansion serve',
    },
    {
      id: 'multilang-mcp',
      name: 'MCP Integration',
      source: 'Tovyr',
      status: runtime ? 'active' : 'available',
      detail: 'Configured MCP servers are available in the active runtime',
    },
    {
      id: 'sequential-thinking',
      name: 'Sequential Thinking',
      source: 'Tovyr',
      status: runtime ? 'active' : 'available',
      detail: 'Use connected reasoning tools when configured',
    },
    {
      id: 'memory-graph',
      name: 'Project Memory',
      source: 'Tovyr',
      status: runtime ? 'active' : 'available',
      detail: '.tovyr project state and connected memory tools',
    },
  ]
}

export function formatExpansionStatusTable(
  opts?: { permissionMode?: PermissionMode },
): string {
  const lines = [
    '# Tovyr extension capabilities',
    '',
    '| Feature | Source | Status |',
    '|---------|--------|--------|',
  ]
  for (const row of getExpansionFeatureStatuses(opts)) {
    lines.push(`| ${row.name} | ${row.source} | ${row.status} — ${row.detail} |`)
  }
  return lines.join('\n')
}

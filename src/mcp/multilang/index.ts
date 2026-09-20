/**
 * Multi-language MCP server launch helpers (Stagehand pattern).
 * Supports Node, Python (uvx), Bun, and Docker runtimes with platform-aware commands.
 */

import { addMcpConfig } from '../../services/mcp/config.js'
import type { ConfigScope } from '../../services/mcp/types.js'
import { getPlatform } from '../../utils/platform.js'

export type McpRuntime = 'node' | 'python' | 'bun' | 'uv' | 'docker'

/** Stagehand SDK languages (docs.stagehand.dev multi-language selector). */
export type StagehandLanguage =
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'ruby'

export interface McpServerLaunchSpec {
  id: string
  runtime: McpRuntime
  command: string
  args: string[]
  env?: Record<string, string>
  description?: string
  languages?: StagehandLanguage[]
}

export const STAGEHAND_LANGUAGES: StagehandLanguage[] = [
  'typescript',
  'python',
  'java',
  'go',
  'ruby',
]

export const MULTILANG_MCP_TEMPLATES: McpServerLaunchSpec[] = [
  {
    id: 'sequential-thinking',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    description: 'Structured step-by-step reasoning with revision and branching',
  },
  {
    id: 'memory',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    description: 'Persistent knowledge graph memory across sessions',
  },
  {
    id: 'fetch',
    runtime: 'uv',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    description: 'Fetch web content for LLM consumption (Python uvx)',
  },
  {
    id: 'stagehand',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@browserbasehq/mcp-server-browserbase'],
    description: 'Stagehand / Browserbase AI browser automation MCP',
    languages: ['typescript', 'python'],
  },
  {
    id: 'playwright',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    description: 'Playwright browser automation MCP (TypeScript)',
    languages: ['typescript'],
  },
  {
    id: 'filesystem',
    runtime: 'node',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    description: 'Secure filesystem access for the project directory',
  },
  {
    id: 'git',
    runtime: 'uv',
    command: 'uvx',
    args: ['mcp-server-git', '--repository', '.'],
    description: 'Git repository tools (Python uvx)',
  },
  {
    id: 'time',
    runtime: 'uv',
    command: 'uvx',
    args: ['mcp-server-time'],
    description: 'Time and timezone conversion',
  },
]

/** Graft built-in in-process servers (no subprocess). */
export const GRAFT_BUILTIN_TEMPLATES: McpServerLaunchSpec[] = [
  {
    id: 'graft-sequential-thinking',
    runtime: 'node',
    command: 'graft-builtin',
    args: ['sequential-thinking'],
    description: 'Built-in sequential thinking (in-process, no npx)',
  },
  {
    id: 'graft-memory',
    runtime: 'node',
    command: 'graft-builtin',
    args: ['memory-graph'],
    description: 'Built-in knowledge graph at .graft/memory-graph.json',
  },
]

export function getMcpTemplate(id: string): McpServerLaunchSpec | undefined {
  return (
    MULTILANG_MCP_TEMPLATES.find(t => t.id === id) ??
    GRAFT_BUILTIN_TEMPLATES.find(t => t.id === id)
  )
}

export function getStagehandTemplate(
  _language: StagehandLanguage = 'typescript',
): McpServerLaunchSpec {
  return getMcpTemplate('stagehand')!
}

/** Wrap npx/uvx for Windows (cmd /c) per MCP servers README. */
export function wrapCommandForPlatform(
  spec: McpServerLaunchSpec,
): { command: string; args: string[] } {
  if (spec.command === 'graft-builtin') {
    return { command: spec.command, args: spec.args }
  }
  if (getPlatform() === 'windows' && (spec.command === 'npx' || spec.command === 'uvx')) {
    return {
      command: 'cmd',
      args: ['/c', spec.command, ...spec.args],
    }
  }
  return { command: spec.command, args: spec.args }
}

export function templateToMcpConfig(
  spec: McpServerLaunchSpec,
): { command: string; args: string[]; env?: Record<string, string> } {
  if (spec.command === 'graft-builtin') {
    return {
      command: 'node',
      args: ['-e', '0'],
      env: {
        GRAFT_BUILTIN_MCP: spec.args[0] ?? spec.id,
        ...spec.env,
      },
    }
  }
  const wrapped = wrapCommandForPlatform(spec)
  return {
    command: wrapped.command,
    args: wrapped.args,
    env: spec.env,
  }
}

export async function installMcpTemplate(
  id: string,
  scope: ConfigScope = 'project',
): Promise<{ name: string; scope: ConfigScope }> {
  const spec = getMcpTemplate(id)
  if (!spec) {
    throw new Error(`Unknown MCP template: ${id}`)
  }
  const name = spec.id
  const config = templateToMcpConfig(spec)
  await addMcpConfig(name, config, scope)
  return { name, scope }
}

export function listMcpTemplateIds(): string[] {
  return [
    ...GRAFT_BUILTIN_TEMPLATES.map(t => t.id),
    ...MULTILANG_MCP_TEMPLATES.map(t => t.id),
  ]
}

export function formatMultilangMcpHelp(): string {
  const lines = [
    '# Multi-language MCP servers',
    '',
    'Built-in (in-process, enabled automatically in Graft):',
    '',
    ...GRAFT_BUILTIN_TEMPLATES.map(
      t => `- **${t.id}** — ${t.description ?? t.runtime}`,
    ),
    '',
    'External templates (install with `/expansion mcp-install <id>`):',
    '',
  ]

  for (const t of MULTILANG_MCP_TEMPLATES) {
    const langs = t.languages?.length
      ? ` · SDK: ${t.languages.join(', ')}`
      : ''
    lines.push(`## ${t.id} (${t.runtime})${langs}`)
    if (t.description) lines.push(t.description)
    lines.push('')
    lines.push('```json')
    const cfg = templateToMcpConfig(t)
    lines.push(
      JSON.stringify(
        {
          mcpServers: {
            [t.id]: cfg,
          },
        },
        null,
        2,
      ),
    )
    lines.push('```', '')
  }

  lines.push(
    'Stagehand supports TypeScript, Python, Java, Go, and Ruby SDKs.',
    'The MCP server uses Browserbase for cloud browser automation.',
    '',
    'Install: `/expansion mcp-install memory` or `/expansion mcp-install stagehand`',
  )
  return lines.join('\n')
}

/**
 * MCP plugin bundles (Phase 15).
 */

export type McpBundle = {
  id: string
  label: string
  servers: string[]
  description: string
}

export const MCP_BUNDLES: McpBundle[] = [
  {
    id: 'github',
    label: 'GitHub',
    servers: ['github'],
    description: 'Issues, PRs, repos — use plugin-github or gh CLI.',
  },
  {
    id: 'cloud-aws',
    label: 'AWS',
    servers: ['aws-serverless-mcp', 'awsiac', 'awsknowledge'],
    description: 'Serverless, IaC, and AWS docs MCPs from Blink mcps/.',
  },
  {
    id: 'cloud-azure',
    label: 'Azure',
    servers: ['azure'],
    description: 'Azure resource and deployment tools.',
  },
  {
    id: 'productivity',
    label: 'Productivity',
    servers: ['notion', 'slack', 'jira'],
    description: 'Notion, Slack, Jira via MCP or Zapier MCP Specialist.',
  },
  {
    id: 'data',
    label: 'Data',
    servers: ['snowflake', 'bigquery', 'clickhouse'],
    description: 'Warehouse and analytics connectors.',
  },
]

export function formatMcpBundleCatalog(): string {
  return [
    '# MCP bundles (Phase 15)',
    '',
    'Curated server groups — enable via `/mcp` or `~/.blink/mcp.json`.',
    '',
    ...MCP_BUNDLES.map(
      b =>
        `- **${b.label}** (\`${b.id}\`): ${b.servers.join(', ')}\n  ${b.description}`,
    ),
    '',
    'Full tree: `mcps/` in Blink source · `/integrations` for skills pack.',
  ].join('\n')
}

export function getMcpBundle(id: string): McpBundle | undefined {
  return MCP_BUNDLES.find(b => b.id === id)
}

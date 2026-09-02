import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  formatSequentialThoughtToolResult,
  type SequentialThoughtInput,
} from '../sequentialThinking.js'

const TOOL_NAME = 'sequentialthinking'

const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    thought: { type: 'string', description: 'Current reasoning step' },
    thoughtNumber: { type: 'integer', minimum: 1 },
    totalThoughts: { type: 'integer', minimum: 1 },
    nextThoughtNeeded: { type: 'boolean' },
    isRevision: { type: 'boolean' },
    revisesThought: { type: 'integer' },
    branchFromThought: { type: 'integer' },
    branchId: { type: 'string' },
    needsMoreThoughts: { type: 'boolean' },
  },
  required: ['thought', 'thoughtNumber', 'totalThoughts', 'nextThoughtNeeded'],
}

function parseThoughtInput(args: Record<string, unknown>): SequentialThoughtInput {
  return {
    thought: String(args.thought ?? ''),
    thoughtNumber: Number(args.thoughtNumber ?? 1),
    totalThoughts: Number(args.totalThoughts ?? 1),
    nextThoughtNeeded: Boolean(args.nextThoughtNeeded),
    isRevision: args.isRevision === true,
    revisesThought:
      args.revisesThought !== undefined ? Number(args.revisesThought) : undefined,
    branchFromThought:
      args.branchFromThought !== undefined
        ? Number(args.branchFromThought)
        : undefined,
    branchId:
      typeof args.branchId === 'string' ? args.branchId : undefined,
    needsMoreThoughts: args.needsMoreThoughts === true,
  }
}

/** In-process MCP server matching @modelcontextprotocol/server-sequential-thinking. */
export function createTovyrSequentialThinkingMcpServer(): Server {
  const server = new Server(
    {
      name: 'tovyr-sequential-thinking',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAME,
        description:
          'Facilitates detailed step-by-step thinking with revision and branching. ' +
          'Call repeatedly until nextThoughtNeeded is false.',
        inputSchema: TOOL_SCHEMA,
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async request => {
    if (request.params.name !== TOOL_NAME) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      }
    }
    const input = parseThoughtInput(
      (request.params.arguments ?? {}) as Record<string, unknown>,
    )
    const text = formatSequentialThoughtToolResult(input)
    return { content: [{ type: 'text', text }] }
  })

  return server
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  addObservations,
  createEntities,
  createRelations,
  deleteEntities,
  deleteObservations,
  deleteRelations,
  openKnowledgeNodes,
  readKnowledgeGraph,
  searchKnowledgeGraph,
} from '../../memory/graph.js'

const KNOWLEDGE_GRAPH_URI = 'memory://knowledge-graph'

const MEMORY_TOOLS = [
  {
    name: 'create_entities',
    description: 'Create multiple new entities in the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              entityType: { type: 'string' },
              observations: { type: 'array', items: { type: 'string' } },
            },
            required: ['name', 'entityType'],
          },
        },
      },
      required: ['entities'],
    },
  },
  {
    name: 'create_relations',
    description: 'Create multiple new relations between entities',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              relationType: { type: 'string' },
            },
            required: ['from', 'to', 'relationType'],
          },
        },
      },
      required: ['relations'],
    },
  },
  {
    name: 'add_observations',
    description: 'Add new observations to existing entities',
    inputSchema: {
      type: 'object',
      properties: {
        observations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string' },
              contents: { type: 'array', items: { type: 'string' } },
            },
            required: ['entityName', 'contents'],
          },
        },
      },
      required: ['observations'],
    },
  },
  {
    name: 'delete_entities',
    description: 'Delete entities and their relations',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: { type: 'array', items: { type: 'string' } },
      },
      required: ['entityNames'],
    },
  },
  {
    name: 'delete_observations',
    description: 'Delete specific observations from entities',
    inputSchema: {
      type: 'object',
      properties: {
        observations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string' },
              contents: { type: 'array', items: { type: 'string' } },
            },
            required: ['entityName', 'contents'],
          },
        },
      },
      required: ['observations'],
    },
  },
  {
    name: 'delete_relations',
    description: 'Delete relations from the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              relationType: { type: 'string' },
            },
            required: ['from', 'to', 'relationType'],
          },
        },
      },
      required: ['relations'],
    },
  },
  {
    name: 'read_graph',
    description: 'Read the entire knowledge graph',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_nodes',
    description: 'Search entities by name, type, or observation text',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'open_nodes',
    description: 'Open specific nodes by name',
    inputSchema: {
      type: 'object',
      properties: {
        names: { type: 'array', items: { type: 'string' } },
      },
      required: ['names'],
    },
  },
] as const

function jsonResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

/** In-process MCP server matching @modelcontextprotocol/server-memory. */
export function createBlinkMemoryGraphMcpServer(cwd: string): Server {
  const server = new Server(
    {
      name: 'blink-memory',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MEMORY_TOOLS.map(t => ({ ...t })),
  }))

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: KNOWLEDGE_GRAPH_URI,
        name: 'Knowledge Graph',
        description: 'Project knowledge graph persisted in .blink/memory-graph.json',
        mimeType: 'application/json',
      },
    ],
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    if (request.params.uri !== KNOWLEDGE_GRAPH_URI) {
      throw new Error(`Unknown resource: ${request.params.uri}`)
    }
    const graph = readKnowledgeGraph(cwd)
    return {
      contents: [
        {
          uri: KNOWLEDGE_GRAPH_URI,
          mimeType: 'application/json',
          text: JSON.stringify(graph, null, 2),
        },
      ],
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>
    try {
      switch (request.params.name) {
        case 'create_entities':
          return jsonResult(
            createEntities(
              cwd,
              (args.entities as Array<{
                name: string
                entityType: string
                observations?: string[]
              }>) ?? [],
            ),
          )
        case 'create_relations':
          return jsonResult(
            createRelations(
              cwd,
              (args.relations as Array<{
                from: string
                to: string
                relationType: string
              }>) ?? [],
            ),
          )
        case 'add_observations':
          return jsonResult(
            addObservations(
              cwd,
              (args.observations as Array<{
                entityName: string
                contents: string[]
              }>) ?? [],
            ),
          )
        case 'delete_entities':
          return jsonResult(
            deleteEntities(cwd, (args.entityNames as string[]) ?? []),
          )
        case 'delete_observations':
          return jsonResult(
            deleteObservations(
              cwd,
              (args.observations as Array<{
                entityName: string
                contents: string[]
              }>) ?? [],
            ),
          )
        case 'delete_relations':
          return jsonResult(
            deleteRelations(
              cwd,
              (args.relations as Array<{
                from: string
                to: string
                relationType: string
              }>) ?? [],
            ),
          )
        case 'read_graph':
          return jsonResult(readKnowledgeGraph(cwd))
        case 'search_nodes':
          return jsonResult(searchKnowledgeGraph(cwd, String(args.query ?? '')))
        case 'open_nodes':
          return jsonResult(
            openKnowledgeNodes(cwd, (args.names as string[]) ?? []),
          )
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
            isError: true,
          }
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      }
    }
  })

  return server
}

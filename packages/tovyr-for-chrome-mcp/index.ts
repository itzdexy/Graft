import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { ChromeSocketBridge, type Logger } from './socket-bridge.js'

export type { Logger }

export type PermissionMode = 'ask' | 'skip_all_permission_checks' | 'follow_a_plan'

export type BrowserTool = { name: string }

export const BROWSER_TOOLS: BrowserTool[] = [
  { name: 'tabs_context_mcp' },
  { name: 'tabs_create_mcp' },
  { name: 'navigate' },
  { name: 'computer' },
  { name: 'find' },
  { name: 'form_input' },
  { name: 'get_page_text' },
  { name: 'gif_creator' },
  { name: 'javascript_tool' },
  { name: 'read_console_messages' },
  { name: 'read_network_requests' },
  { name: 'read_page' },
  { name: 'resize_window' },
  { name: 'shortcuts_list' },
  { name: 'shortcuts_execute' },
  { name: 'switch_browser' },
  { name: 'update_plan' },
  { name: 'upload_image' },
]

export type ClaudeForChromeContext = {
  serverName?: string
  logger: Logger
  socketPath: string
  getSocketPaths: () => string[]
  onToolCallDisconnected: () => string
  initialPermissionMode?: PermissionMode
  clientTypeId?: string
  onAuthenticationError?: () => void
  onExtensionPaired?: (deviceId: string, name: string) => void
  getPersistedDeviceId?: () => string | undefined
  bridgeConfig?: Record<string, unknown>
  trackEvent?: (eventName: string, metadata?: Record<string, unknown>) => void
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

function coerceArgs(args: Record<string, unknown>) {
  if (typeof args.tabId === 'string') args.tabId = Number(args.tabId)
  for (const key of ['coordinate', 'start_coordinate', 'region'] as const) {
    if (typeof args[key] === 'string') {
      try {
        args[key] = JSON.parse(args[key] as string)
      } catch {
        // keep original
      }
    }
  }
}

function registerBrowserTools(server: McpServer, bridge: ChromeSocketBridge) {
  const callTool = async (toolName: string, args: Record<string, unknown>) => {
    coerceArgs(args)
    try {
      const result = await bridge.callTool(toolName, args)
      if (typeof result === 'string') return textResult(result)
      if (result && typeof result === 'object' && 'content' in result) {
        return result as { content: Array<Record<string, unknown>> }
      }
      return textResult(JSON.stringify(result, null, 2))
    } catch (err) {
      return textResult(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  server.tool(
    'tabs_context_mcp',
    'Get context about the MCP tab group. Call this before other browser tools.',
    {
      createIfEmpty: z.boolean().optional(),
    },
    async args => callTool('tabs_context_mcp', args),
  )

  server.tool(
    'tabs_create_mcp',
    'Create a new tab in the MCP tab group.',
    {},
    async args => callTool('tabs_create_mcp', args),
  )

  server.tool(
    'navigate',
    'Navigate to a URL or go back/forward in history.',
    {
      url: z.string(),
      tabId: z.number(),
    },
    async args => callTool('navigate', args),
  )

  server.tool(
    'computer',
    'Mouse, keyboard, and screenshot automation in the browser.',
    {
      action: z.enum([
        'left_click',
        'right_click',
        'double_click',
        'triple_click',
        'type',
        'screenshot',
        'wait',
        'scroll',
        'key',
        'left_click_drag',
        'zoom',
        'scroll_to',
        'hover',
      ]),
      tabId: z.number(),
      coordinate: z.array(z.number()).min(2).max(2).optional(),
      duration: z.number().min(0).max(30).optional(),
      modifiers: z.string().optional(),
      ref: z.string().optional(),
      region: z.array(z.number()).min(4).max(4).optional(),
      repeat: z.number().min(1).max(100).optional(),
      scroll_direction: z.enum(['up', 'down', 'left', 'right']).optional(),
      scroll_amount: z.number().min(1).max(10).optional(),
      start_coordinate: z.array(z.number()).min(2).max(2).optional(),
      text: z.string().optional(),
    },
    async args => callTool('computer', args),
  )

  server.tool(
    'find',
    'Find elements on the page using natural language.',
    {
      query: z.string(),
      tabId: z.number(),
    },
    async args => callTool('find', args),
  )

  server.tool(
    'form_input',
    'Set form field values by element ref.',
    {
      ref: z.string(),
      value: z.union([z.string(), z.boolean(), z.number()]),
      tabId: z.number(),
    },
    async args => callTool('form_input', args),
  )

  server.tool(
    'get_page_text',
    'Extract article/main text from the page.',
    { tabId: z.number() },
    async args => callTool('get_page_text', args),
  )

  server.tool(
    'javascript_tool',
    'Execute JavaScript in the page context.',
    {
      action: z.literal('javascript_exec'),
      text: z.string(),
      tabId: z.number(),
    },
    async args => callTool('javascript_tool', args),
  )

  server.tool(
    'read_console_messages',
    'Read filtered browser console output.',
    {
      tabId: z.number(),
      pattern: z.string().optional(),
      limit: z.number().optional(),
      onlyErrors: z.boolean().optional(),
      clear: z.boolean().optional(),
    },
    async args => callTool('read_console_messages', args),
  )

  server.tool(
    'read_network_requests',
    'Read network requests from the tab.',
    {
      tabId: z.number(),
      urlPattern: z.string().optional(),
      limit: z.number().optional(),
      clear: z.boolean().optional(),
    },
    async args => callTool('read_network_requests', args),
  )

  server.tool(
    'read_page',
    'Accessibility tree of page elements with refs.',
    {
      tabId: z.number(),
      filter: z.enum(['interactive', 'all']).optional(),
      depth: z.number().optional(),
      ref_id: z.string().optional(),
      max_chars: z.number().optional(),
    },
    async args => callTool('read_page', args),
  )

  server.tool(
    'resize_window',
    'Resize the browser window.',
    {
      width: z.number(),
      height: z.number(),
      tabId: z.number(),
    },
    async args => callTool('resize_window', args),
  )

  server.tool(
    'gif_creator',
    'Record browser actions as GIF (stub).',
    {
      action: z.enum(['start_recording', 'stop_recording', 'export', 'clear']),
      tabId: z.number(),
      download: z.boolean().optional(),
      filename: z.string().optional(),
    },
    async args => callTool('gif_creator', args),
  )

  server.tool(
    'shortcuts_list',
    'List shortcuts (stub).',
    { tabId: z.number() },
    async args => callTool('shortcuts_list', args),
  )

  server.tool(
    'shortcuts_execute',
    'Execute shortcut (stub).',
    {
      tabId: z.number(),
      shortcutId: z.string().optional(),
      command: z.string().optional(),
    },
    async args => callTool('shortcuts_execute', args),
  )

  server.tool(
    'switch_browser',
    'Switch connected browser (stub).',
    {},
    async args => callTool('switch_browser', args),
  )

  server.tool(
    'update_plan',
    'Present a browsing plan (auto-approved in Tovyr).',
    {
      domains: z.array(z.string()),
      approach: z.array(z.string()),
    },
    async args => callTool('update_plan', args),
  )

  server.tool(
    'upload_image',
    'Upload screenshot to file input or drop target.',
    {
      imageId: z.string(),
      tabId: z.number(),
      ref: z.string().optional(),
      coordinate: z.array(z.number()).optional(),
      filename: z.string().optional(),
    },
    async args => callTool('upload_image', args),
  )
}

export function createClaudeForChromeMcpServer(context: ClaudeForChromeContext) {
  const bridge = new ChromeSocketBridge(
    context.getSocketPaths,
    context.logger,
    context.onToolCallDisconnected,
  )

  const server = new McpServer({
    name: context.serverName ?? 'tovyr-in-chrome',
    version: '1.0.0',
  })

  registerBrowserTools(server, bridge)
  return server
}

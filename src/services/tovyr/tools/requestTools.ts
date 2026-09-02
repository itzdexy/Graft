const LEGACY_WEB_TOOLS = new Set(['WebFetch', 'WebSearch'])
const UNIFIED_WEB_TOOL = 'TovyrWeb'

export function resolveLocalClockToolName(
  tools: Array<{ name: string }>,
  platform: NodeJS.Platform = process.platform,
): 'PowerShell' | 'Bash' | null {
  if (
    platform === 'win32' &&
    tools.some(tool => tool.name === 'PowerShell')
  ) {
    return 'PowerShell'
  }
  return tools.some(tool => tool.name === 'Bash') ? 'Bash' : null
}

/**
 * Keep the main-loop tool surface small and unambiguous. TovyrWeb implements
 * both read and search, so exposing the legacy pair encourages weak models to
 * repeat the same request through every available web tool.
 */
export function selectTovyrRequestTools<T extends { name: string }>(
  tools: T[],
  casualConversation: boolean,
  webAlreadyResolved = false,
  contextualWebTask = false,
): T[] {
  if (casualConversation) return []
  if (contextualWebTask && webAlreadyResolved) return []
  if (contextualWebTask) {
    return tools.filter(tool => tool.name === UNIFIED_WEB_TOOL)
  }
  if (webAlreadyResolved) {
    return tools.filter(
      tool =>
        tool.name !== UNIFIED_WEB_TOOL && !LEGACY_WEB_TOOLS.has(tool.name),
    )
  }
  if (!tools.some(tool => tool.name === UNIFIED_WEB_TOOL)) return tools
  return tools.filter(tool => !LEGACY_WEB_TOOLS.has(tool.name))
}

/** Detect a completed unified-web *read/browse* (not search) in context. */
export function hasResolvedTovyrWebResult(messages: unknown[]): boolean {
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue
    const content = (message as { message?: { content?: unknown } }).message
      ?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (!block || typeof block !== 'object') continue
      const candidate = block as {
        type?: unknown
        is_error?: unknown
        content?: unknown
      }
      if (
        candidate.type === 'tool_result' &&
        candidate.is_error !== true &&
        typeof candidate.content === 'string' &&
        (/^\[TovyrWeb (read|browse)\]/.test(candidate.content) ||
          // Legacy prefix without action — treat as resolved content fetch.
          (candidate.content.startsWith('[TovyrWeb]') &&
            !candidate.content.startsWith('[TovyrWeb search]')))
      ) {
        return true
      }
    }
  }
  return false
}

import type {
  AutomationAction,
  AutomationAdapter,
  AutomationObservation,
  AutomationTarget,
} from '../providers/automation.js'
import { validateBrowserAutomationUrl } from './urlSafety.js'

export type PlaywrightMcpResult = {
  content?: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType?: string }
    | Record<string, unknown>
  >
  isError?: boolean
}

export type PlaywrightMcpInvoker = (
  tool: string,
  input: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<PlaywrightMcpResult>

function observation(
  target: AutomationTarget,
  result: PlaywrightMcpResult | void,
): AutomationObservation {
  const content = result?.content ?? []
  const accessibilityTree = content
    .filter(
      (item): item is { type: 'text'; text: string } =>
        item.type === 'text' && typeof item.text === 'string',
    )
    .map(item => item.text)
    .join('\n')
  const image = content.find(
    (item): item is { type: 'image'; data: string; mimeType?: string } =>
      item.type === 'image' && typeof item.data === 'string',
  )
  return {
    target,
    accessibilityTree: accessibilityTree || undefined,
    screenshotBase64: image?.data,
  }
}

export function playwrightToolForAction(action: AutomationAction): {
  tool: string
  input: Record<string, unknown>
} {
  switch (action.type) {
    case 'observe':
      return { tool: 'browser_snapshot', input: {} }
    case 'navigate': {
      const safe = validateBrowserAutomationUrl(action.url)
      if (!safe.ok) throw new Error(safe.reason)
      return { tool: 'browser_navigate', input: { url: safe.url } }
    }
    case 'click':
      return {
        tool: 'browser_click',
        input: { ref: action.ref, element: action.ref || 'selected element' },
      }
    case 'type':
      return {
        tool: 'browser_type',
        input: {
          ref: action.ref,
          element: action.ref || 'selected field',
          text: action.text,
        },
      }
    case 'scroll':
      return {
        tool: 'browser_mouse_wheel',
        input: { deltaX: action.deltaX ?? 0, deltaY: action.deltaY },
      }
    case 'keypress':
      return { tool: 'browser_press_key', input: { key: action.keys.join('+') } }
    case 'screenshot':
      return { tool: 'browser_take_screenshot', input: { type: 'png' } }
    case 'upload':
      return { tool: 'browser_file_upload', input: { paths: action.paths } }
    case 'download':
      if (!action.url) {
        throw new Error('A download URL or an explicit page click is required.')
      }
      return playwrightToolForAction({
        type: 'navigate',
        target: action.target,
        url: action.url,
      })
    case 'clipboard_read':
    case 'clipboard_write':
    case 'open_application':
    case 'purchase':
    case 'send_external_message':
    case 'change_account':
    case 'destructive':
      throw new Error(`${action.type} is not a browser action.`)
  }
}

export class PlaywrightAutomationAdapter implements AutomationAdapter {
  readonly id = 'playwright-mcp'
  readonly kind = 'browser' as const

  constructor(
    private readonly invoke: PlaywrightMcpInvoker,
    private readonly available: () => Promise<boolean>,
  ) {}

  isAvailable(): Promise<boolean> {
    return this.available()
  }

  async observe(
    target: AutomationTarget,
    signal: AbortSignal,
  ): Promise<AutomationObservation> {
    const result = await this.invoke('browser_snapshot', {}, signal)
    if (result.isError) throw new Error('Playwright snapshot failed.')
    return observation(target, result)
  }

  async act(
    action: AutomationAction,
    signal: AbortSignal,
  ): Promise<AutomationObservation | void> {
    const mapped = playwrightToolForAction(action)
    const result = await this.invoke(mapped.tool, mapped.input, signal)
    if (result.isError) {
      throw new Error(`Playwright action ${mapped.tool} failed.`)
    }
    return observation(action.target, result)
  }

  async close(): Promise<void> {
    const controller = new AbortController()
    await this.invoke('browser_close', {}, controller.signal)
  }
}

/**
 * Minimal Chrome DevTools Protocol client.
 *
 * Only what an agent needs to look at a page: navigate, wait for load, read the
 * DOM, run an expression, screenshot. Deliberately not a Playwright
 * replacement — Playwright is a ~300MB dependency plus a browser download,
 * where CDP drives a browser the user already has using `ws`, which is already
 * installed.
 */
import { WebSocket } from 'ws'

export type CdpTarget = {
  id: string
  title: string
  url: string
  webSocketDebuggerUrl: string
  type: string
}

/** Shape of an entry from /json/list, before we trust any of it. */
type RawTarget = Record<string, unknown>

/** Page targets only — /json/list also returns service workers and extensions. */
export function parsePageTargets(payload: unknown): CdpTarget[] {
  if (!Array.isArray(payload)) return []
  const targets: CdpTarget[] = []
  for (const raw of payload) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as RawTarget
    if (item.type !== 'page') continue
    const ws = item.webSocketDebuggerUrl
    const id = item.id
    if (typeof ws !== 'string' || typeof id !== 'string') continue
    targets.push({
      id,
      title: typeof item.title === 'string' ? item.title : '',
      url: typeof item.url === 'string' ? item.url : '',
      webSocketDebuggerUrl: ws,
      type: 'page',
    })
  }
  return targets
}

type Pending = {
  resolve: (value: Record<string, unknown>) => void
  reject: (reason: Error) => void
}

export class CdpSession {
  private socket: WebSocket | null = null
  private nextId = 1
  private readonly pending = new Map<number, Pending>()

  constructor(private readonly wsUrl: string) {}

  async connect(timeoutMs = 15_000): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      // maxPayload raised because DOM.getOuterHTML on a real page routinely
      // exceeds ws's 100MB default only rarely, but a 1MB default would break
      // constantly — be explicit rather than depending on the library default.
      const socket = new WebSocket(this.wsUrl, { maxPayload: 64 * 1024 * 1024 })
      const timer = setTimeout(() => {
        socket.close()
        reject(new Error(`CDP connect timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      timer.unref?.()

      socket.on('open', () => {
        clearTimeout(timer)
        this.socket = socket
        resolve()
      })
      socket.on('error', error => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      })
      socket.on('message', data => this.onMessage(String(data)))
      socket.on('close', () => this.failAllPending('CDP socket closed'))
    })
  }

  private onMessage(raw: string): void {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }
    const id = parsed.id
    if (typeof id !== 'number') return // an event, not a command reply
    const waiter = this.pending.get(id)
    if (!waiter) return
    this.pending.delete(id)

    const error = parsed.error as { message?: string } | undefined
    if (error) {
      waiter.reject(new Error(error.message ?? 'CDP error'))
      return
    }
    waiter.resolve((parsed.result as Record<string, unknown>) ?? {})
  }

  private failAllPending(reason: string): void {
    for (const [, waiter] of this.pending) {
      waiter.reject(new Error(reason))
    }
    this.pending.clear()
  }

  /** Issue a CDP command and await its reply. */
  send(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 30_000,
  ): Promise<Record<string, unknown>> {
    const socket = this.socket
    if (!socket) return Promise.reject(new Error('CDP session not connected'))

    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      timer.unref?.()

      this.pending.set(id, {
        resolve: value => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: error => {
          clearTimeout(timer)
          reject(error)
        },
      })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close(): void {
    this.failAllPending('CDP session closed')
    this.socket?.close()
    this.socket = null
  }
}

/** `Runtime.evaluate` result, unwrapped to a plain string. */
export function unwrapEvaluateString(result: Record<string, unknown>): string {
  const inner = result.result as { value?: unknown } | undefined
  const value = inner?.value
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

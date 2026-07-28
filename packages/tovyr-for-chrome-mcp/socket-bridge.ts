import { connect, type Socket } from 'node:net'

const MAX_MESSAGE_SIZE = 1024 * 1024
const TOOL_TIMEOUT_MS = 120_000

export type Logger = {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export class ChromeSocketBridge {
  private socket: Socket | null = null
  private buffer = Buffer.alloc(0)
  private pending: {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null
  private queue: Array<{
    method: string
    params: unknown
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }> = []

  constructor(
    private readonly getSocketPaths: () => string[],
    private readonly logger: Logger,
    private readonly onDisconnectedMessage: () => string,
  ) {}

  async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return

    const paths = this.getSocketPaths()
    let lastError: Error | null = null

    for (const path of paths) {
      try {
        await this.tryConnect(path)
        this.logger.info(`Connected to Chrome bridge at ${path}`)
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        this.logger.debug(`Socket connect failed for ${path}: ${lastError.message}`)
      }
    }

    throw lastError ?? new Error(this.onDisconnectedMessage())
  }

  private tryConnect(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = connect(socketPath)
      const onError = (err: Error) => {
        socket.removeAllListeners()
        socket.destroy()
        reject(err)
      }

      socket.once('error', onError)
      socket.once('connect', () => {
        socket.removeListener('error', onError)
        socket.on('error', err => {
          this.logger.warn(`Chrome bridge socket error: ${err.message}`)
          this.handleDisconnect()
        })
        socket.on('close', () => this.handleDisconnect())
        socket.on('data', chunk => this.onData(chunk))
        this.socket = socket
        resolve()
      })
    })
  }

  private handleDisconnect() {
    this.socket = null
    if (this.pending) {
      clearTimeout(this.pending.timer)
      this.pending.reject(new Error(this.onDisconnectedMessage()))
      this.pending = null
    }
    for (const item of this.queue) {
      item.reject(new Error(this.onDisconnectedMessage()))
    }
    this.queue = []
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk])

    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0)
      if (length === 0 || length > MAX_MESSAGE_SIZE) {
        this.handleDisconnect()
        return
      }
      if (this.buffer.length < 4 + length) break

      const body = this.buffer.subarray(4, 4 + length).toString('utf8')
      this.buffer = this.buffer.subarray(4 + length)

      let message: Record<string, unknown>
      try {
        message = JSON.parse(body) as Record<string, unknown>
      } catch {
        continue
      }

      if (!this.pending) continue

      if (typeof message.error === 'string') {
        const { reject, timer } = this.pending
        clearTimeout(timer)
        this.pending = null
        reject(new Error(message.error))
      } else {
        const { resolve, timer } = this.pending
        clearTimeout(timer)
        this.pending = null
        resolve(message.result ?? message)
      }
      void this.flushQueue()
    }
  }

  private flushQueue() {
    if (this.pending || this.queue.length === 0) return
    const next = this.queue.shift()
    if (!next) return
    void this.sendNow(next.method, next.params, next.resolve, next.reject)
  }

  async callTool(method: string, params: unknown): Promise<unknown> {
    await this.connect().catch(() => {
      throw new Error(this.onDisconnectedMessage())
    })

    return new Promise((resolve, reject) => {
      const item = { method, params, resolve, reject }
      if (this.pending) {
        this.queue.push(item)
        return
      }
      void this.sendNow(method, params, resolve, reject)
    })
  }

  private async sendNow(
    method: string,
    params: unknown,
    resolve: (value: unknown) => void,
    reject: (error: Error) => void,
  ) {
    if (!this.socket || this.socket.destroyed) {
      reject(new Error(this.onDisconnectedMessage()))
      return
    }

    const timer = setTimeout(() => {
      if (this.pending) {
        this.pending = null
        reject(new Error(`Tool request timed out after ${TOOL_TIMEOUT_MS / 1000}s`))
        void this.flushQueue()
      }
    }, TOOL_TIMEOUT_MS)

    this.pending = { resolve, reject, timer }

    const payload = Buffer.from(JSON.stringify({ method, params }), 'utf8')
    const header = Buffer.alloc(4)
    header.writeUInt32LE(payload.length, 0)

    try {
      this.socket.write(Buffer.concat([header, payload]))
    } catch (err) {
      clearTimeout(timer)
      this.pending = null
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  }
}

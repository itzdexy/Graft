import type { StdoutMessage } from '../../entrypoints/sdk/controlTypes.js'

/** Common contract for the WebSocket, hybrid, and SSE session transports. */
export interface Transport {
  connect(): Promise<void>
  write(message: StdoutMessage): Promise<void>
  close(): void
  setOnData(callback: (data: string) => void): void
  setOnClose(callback: (closeCode?: number) => void): void
  setOnConnect?(callback: () => void): void
}

/** Stub for Anthropic-internal @ant/computer-use-mcp (external / Blink builds). */

export * from './types.js'

export const API_RESIZE_PARAMS = { maxWidth: 1280, maxHeight: 800 }

export function targetImageSize(width: number, height: number): {
  width: number
  height: number
} {
  return { width, height }
}

export function buildComputerUseTools(): never[] {
  return []
}

export function createComputerUseMcpServer(): never {
  throw new Error('Computer use is not available in this build')
}

export function bindSessionContext(_ctx: unknown): void {}

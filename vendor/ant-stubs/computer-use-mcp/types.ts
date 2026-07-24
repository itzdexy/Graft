/** Stub types for @ant/computer-use-mcp/types */

export type CoordinateMode = 'normalized' | 'pixel'

export type CuSubGates = Record<string, boolean>

export type CuPermissionRequest = {
  apps?: string[]
  tccState?: unknown
}

export type CuPermissionResponse = {
  granted: string[]
  denied: string[]
  flags: Record<string, boolean>
}

export const DEFAULT_GRANT_FLAGS: Record<string, boolean> = {}

export type ComputerExecutor = Record<string, unknown>
export type DisplayGeometry = Record<string, unknown>
export type FrontmostApp = Record<string, unknown>
export type InstalledApp = Record<string, unknown>
export type ResolvePrepareCaptureResult = Record<string, unknown>
export type RunningApp = Record<string, unknown>
export type ScreenshotResult = Record<string, unknown>
export type ComputerUseSessionContext = Record<string, unknown>
export type CuCallToolResult = Record<string, unknown>
export type ScreenshotDims = { width: number; height: number }

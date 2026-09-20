/**
 * Stub types for @ant/computer-use-mcp/types.
 *
 * The real package is Anthropic-internal and is not vendored here, so these
 * shapes are reconstructed from how this repository actually consumes them.
 * They were previously all `Record<string, unknown>`, which type-checks as a
 * declaration but describes nothing: every consumer property access became an
 * error, 76 of them, and they drowned out the resolution failures that were
 * real bugs.
 *
 * Reconstructed, not authoritative. If the real package ever lands, delete
 * this file rather than reconciling it -- a guess that has drifted is worse
 * than no guess.
 */

export type CoordinateMode = 'normalized' | 'pixel'

export type CuSubGates = Record<string, boolean>

/** macOS TCC (privacy) grants the executor depends on. */
export type CuTccState = {
  accessibility: boolean
  screenRecording: boolean
}

/** An app resolved to a concrete bundle, or not found on this machine. */
export type CuResolvedApp = {
  bundleId: string
  displayName: string
  path?: string
}

export type CuRequestedApp = {
  /** What the model asked for, before resolution. */
  requestedName: string
  /** Null when nothing on the machine matched. */
  resolved: CuResolvedApp | null
  /** True when a prior approval already covers this app. */
  alreadyGranted?: boolean
}

/** Grants that apply to the session rather than to one app. */
export type CuGrantFlags = {
  clipboardRead: boolean
  clipboardWrite: boolean
  systemKeyCombos: boolean
}

export type CuPermissionRequest = {
  apps?: CuRequestedApp[]
  tccState?: CuTccState
  requestedFlags: CuGrantFlags
  /** One-line explanation shown in the approval dialog. */
  reason?: string
  /** Apps that will be hidden while the session runs. */
  willHide?: CuResolvedApp[]
}

export type CuGrantedApp = {
  bundleId: string
  displayName: string
  grantedAt: number
}

export type CuDeniedApp = {
  bundleId: string
  reason: 'not_installed' | 'user_denied'
}

export type CuPermissionResponse = {
  granted: CuGrantedApp[]
  denied: CuDeniedApp[]
  flags: CuGrantFlags
}

export const DEFAULT_GRANT_FLAGS: CuGrantFlags = {
  clipboardRead: false,
  clipboardWrite: false,
  systemKeyCombos: false,
}

/** A display's logical geometry plus the backing scale factor. */
export type DisplayGeometry = {
  displayId: number
  width: number
  height: number
  scaleFactor: number
  x?: number
  y?: number
  isMain?: boolean
}

export type FrontmostApp = {
  bundleId: string
  displayName: string
}

export type InstalledApp = {
  bundleId: string
  displayName: string
  path?: string
  /** Populated only by callers that render an icon. */
  iconDataUrl?: string
}

export type RunningApp = {
  bundleId: string
  displayName: string
  pid?: number
}

export type ScreenshotDims = { width: number; height: number }

export type ScreenshotResult = {
  data: string
  mediaType: string
  dims?: ScreenshotDims
}

export type ResolvePrepareCaptureResult = {
  activated?: string
  hidden?: string[]
  displayId?: number
}

export type ComputerExecutor = Record<string, unknown>
export type ComputerUseSessionContext = Record<string, unknown>
export type CuCallToolResult = Record<string, unknown>

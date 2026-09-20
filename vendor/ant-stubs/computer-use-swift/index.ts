/**
 * Stub for the Anthropic-internal @ant/computer-use-swift native binding.
 *
 * The real addon is not vendored here, so this describes only the surface
 * this repository actually calls, reconstructed from the call sites in
 * utils/computerUse/. It was previously `Record<string, unknown>`, which made
 * every `cu.apps.x()` and `cu.display.y()` an `unknown` access.
 *
 * The default export is an empty object on purpose: nothing in a Graft build
 * has a native addon to bind to, and requireComputerUseSwift() is only
 * reached on macOS behind the computer-use gate. Reconstructed, not
 * authoritative -- delete this rather than reconcile it if the real package
 * ever lands.
 */
import type {
  DisplayGeometry,
  FrontmostApp,
  InstalledApp,
  ResolvePrepareCaptureResult,
  ScreenshotResult,
} from '../computer-use-mcp/types.js'

export type ComputerUseAppsApi = {
  /** Bring the allowlisted apps forward and hide the rest. */
  prepareDisplay(
    allowlistBundleIds: string[],
    surrogateHost: string,
    displayId?: number,
  ): Promise<ResolvePrepareCaptureResult>
  /** What prepareDisplay would hide, without doing it. */
  previewHideSet(
    bundleIds: string[],
    displayId?: number,
  ): Promise<Array<{ bundleId: string; displayName: string }>>
  findWindowDisplays(
    bundleIds: string[],
  ): Promise<Array<{ bundleId: string; displayIds: number[] }>>
  appUnderPoint(x: number, y: number): Promise<FrontmostApp | null>
  listInstalled(): Promise<InstalledApp[]>
  open(bundleId: string): Promise<void>
  unhide(bundleIds?: string[]): void
}

/** macOS privacy (TCC) probes. */
export type ComputerUseTccApi = {
  checkAccessibility(): boolean
  checkScreenRecording(): boolean
}

export type ComputerUseScreenshotApi = {
  captureExcluding(
    excludedBundleIds: string[],
    jpegQuality: number,
    targetWidth: number,
    targetHeight: number,
    displayId?: number,
  ): Promise<ScreenshotResult>
  captureRegion(
    excludedBundleIds: string[],
    x: number,
    y: number,
    width: number,
    height: number,
    outWidth: number,
    outHeight: number,
    jpegQuality: number,
    displayId?: number,
  ): Promise<ScreenshotResult>
}

export type ComputerUseDisplayApi = {
  getSize(displayId?: number): DisplayGeometry
  listAll(): DisplayGeometry[]
}

export type ComputerUseHotkeyApi = {
  /** False when the event tap could not be created (missing Accessibility). */
  registerEscape(onEscape: () => void): boolean
  unregister(): void
  /** Suppress the next ESC because we are about to send one ourselves. */
  notifyExpectedEscape(): void
}

export type ComputerUseAPI = {
  apps: ComputerUseAppsApi
  display: ComputerUseDisplayApi
  hotkey: ComputerUseHotkeyApi
  tcc: ComputerUseTccApi
  screenshot: ComputerUseScreenshotApi
  /** Focus, hide and capture in one @MainActor hop. */
  resolvePrepareCapture(
    allowedBundleIds: string[],
    surrogateHost: string,
    jpegQuality: number,
    targetWidth: number,
    targetHeight: number,
    preferredDisplayId?: number,
    autoResolve?: boolean,
    doHide?: boolean,
  ): Promise<ResolvePrepareCaptureResult>
  /** Pumps the macOS main run loop so @MainActor work can complete. */
  _drainMainRunLoop(): void
}

const stub = {} as ComputerUseAPI

export default stub

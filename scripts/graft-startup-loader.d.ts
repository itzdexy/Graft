export type GraftStartupLoaderPhase = 'compile' | 'modules'

export declare function shouldShowGraftStartupLoader(): boolean
export declare function shouldShowStartupTips(): boolean
export declare function formatProgressBar(progress: number, width?: number): string
export declare function formatElapsedSeconds(ms: number): string
export declare function pickStartupTip(index: number): string | undefined
export declare function formatStartupLoaderFrame(input: {
  frame: number
  elapsedMs: number
  phase: GraftStartupLoaderPhase
  progress?: number
  columns?: number
}): string
export declare function startGraftStartupLoader(
  initialPhase?: GraftStartupLoaderPhase,
): void
export declare function setGraftStartupPhase(next: GraftStartupLoaderPhase): void
export declare function stopGraftStartupLoader(opts?: {
  keepCursorHidden?: boolean
}): void
export declare function getGraftStartupElapsedMs(): number

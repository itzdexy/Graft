export type TovyrStartupLoaderPhase = 'compile' | 'modules'

export declare function shouldShowTovyrStartupLoader(): boolean
export declare function shouldShowStartupTips(): boolean
export declare function formatProgressBar(progress: number, width?: number): string
export declare function formatElapsedSeconds(ms: number): string
export declare function pickStartupTip(index: number): string | undefined
export declare function formatStartupLoaderFrame(input: {
  frame: number
  elapsedMs: number
  phase: TovyrStartupLoaderPhase
  progress?: number
  columns?: number
}): string
export declare function startTovyrStartupLoader(
  initialPhase?: TovyrStartupLoaderPhase,
): void
export declare function setTovyrStartupPhase(next: TovyrStartupLoaderPhase): void
export declare function stopTovyrStartupLoader(opts?: {
  keepCursorHidden?: boolean
}): void
export declare function getTovyrStartupElapsedMs(): number

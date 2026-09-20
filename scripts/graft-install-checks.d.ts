export declare function getGraftPathCandidates(
  env?: NodeJS.ProcessEnv,
): string[]
export declare function pathEntries(pathEnv: string): string[]
export declare function pathContainsDir(pathEnv: string, dir: string): boolean
export declare function missingPathDirs(
  pathEnv: string,
  candidates?: string[],
): string[]
export declare function formatPathFixHint(
  missingDirs: string[],
  platform?: string,
): string
export declare function npmGlobalGraftShimPaths(env?: NodeJS.ProcessEnv): string[]
export declare function localGraftShimPaths(env?: NodeJS.ProcessEnv): string[]
export declare function summarizeInstallPathState(env?: NodeJS.ProcessEnv): {
  missingDirs: string[]
  hint: string
  ok: boolean
}

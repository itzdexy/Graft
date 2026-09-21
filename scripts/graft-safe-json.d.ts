export declare function readJsonSafe<T = Record<string, unknown>>(path: string, fallback?: T): T
export declare function writeJsonAtomic(path: string, value: unknown, options?: { mode?: number }): string

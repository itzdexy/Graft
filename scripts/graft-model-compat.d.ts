export declare const GRAFT_COMPAT_ENV_KEYS: string[]

export declare function isOfficialClaudeProvider(
  provider: { id?: string; baseUrl?: string } | null | undefined,
): boolean
export declare function modelLooksLikeClaude(
  modelId: string | null | undefined,
): boolean
export declare function getGraftProviderCompatEnv(
  providerId: string,
  modelId?: string,
): Record<string, string>
export declare function applyGraftProviderCompatToProcess(
  providerId: string,
  modelId?: string,
): void
export declare function mergeGraftCompatIntoSettingsEnv(
  env: Record<string, unknown>,
  providerId: string,
  modelId?: string,
): Record<string, unknown>

export declare const TOVYR_COMPAT_ENV_KEYS: string[]

export declare function isOfficialClaudeProvider(
  provider: { id?: string; baseUrl?: string } | null | undefined,
): boolean
export declare function modelLooksLikeClaude(
  modelId: string | null | undefined,
): boolean
export declare function getTovyrProviderCompatEnv(
  providerId: string,
  modelId?: string,
): Record<string, string>
export declare function applyTovyrProviderCompatToProcess(
  providerId: string,
  modelId?: string,
): void
export declare function mergeTovyrCompatIntoSettingsEnv(
  env: Record<string, unknown>,
  providerId: string,
  modelId?: string,
): Record<string, unknown>

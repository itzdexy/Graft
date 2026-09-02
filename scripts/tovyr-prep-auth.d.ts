export type TovyrPreparedProvider = {
  providerId: string
  label: string
  baseUrl: string
  apiKey: string
  model: string
  authMode: 'apiKey' | 'authToken' | 'oauth'
}

export declare function buildTovyrChildAuthEnv(): Record<string, string>
export declare function persistActiveProvider(
  config?: unknown,
): TovyrPreparedProvider | null
export declare function applyActiveProviderToProcess(): TovyrPreparedProvider
export declare function prepareTovyrAuth(): string

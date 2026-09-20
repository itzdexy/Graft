export type GraftPreparedProvider = {
  providerId: string
  label: string
  baseUrl: string
  apiKey: string
  model: string
  authMode: 'apiKey' | 'authToken' | 'oauth'
}

export declare function buildGraftChildAuthEnv(): Record<string, string>
export declare function persistActiveProvider(
  config?: unknown,
): GraftPreparedProvider | null
export declare function applyActiveProviderToProcess(): GraftPreparedProvider
export declare function prepareGraftAuth(): string

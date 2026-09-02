export type TovyrModelTier = 'opus' | 'sonnet' | 'haiku'

export type TovyrModel = {
  id: string
  label: string
  tier: TovyrModelTier
  context?: string
}

export type TovyrProviderCategory =
  | 'direct'
  | 'gateway'
  | 'api'
  | 'regional'
  | 'cloud'
  | 'self_hosted'
  | 'media_voice'
  | 'media_image'
  | 'media_video'

export type TovyrProviderState = {
  active: string
  keys: Record<string, string>
  models: Record<string, string>
  auth: Record<string, 'oauth'>
  custom: { baseUrl: string; label?: string }
  endpoints: Record<string, string>
}

export type TovyrProvider = {
  id: string
  label: string
  category: TovyrProviderCategory
  baseUrl: string
  keyPrefix: string
  keyHint: string
  signup: string
  authMode?: 'apiKey' | 'authToken'
  models: TovyrModel[]
  defaultModel?: string
  custom?: boolean
  anyModel?: boolean
  apiFormat?: 'tovyr' | 'openai'
  featured?: boolean
  regions?: string[]
  notes?: string
  local?: boolean
  keyPattern?: string
}

export type ResolvedTovyrSelection = {
  providerId: string
  label: string
  baseUrl: string
  apiKey: string
  model: string
  authMode: 'apiKey' | 'authToken' | 'oauth'
}

export declare const DEFAULT_PROVIDER_ID: string
export declare const PROVIDER_CATALOG: Record<string, TovyrProvider>
export declare const PROVIDER_CATEGORIES: Record<
  TovyrProviderCategory,
  string
>

export declare function loadState(): TovyrProviderState
export declare function saveState(state: TovyrProviderState): string
export declare function getProvider(
  id: string,
  state?: TovyrProviderState,
): TovyrProvider | null
export declare function getActiveProviderId(
  state?: TovyrProviderState,
): string
export declare function getActiveModelId(
  providerId: string,
  state?: TovyrProviderState,
): string
export declare function sanitizeKey(
  provider: TovyrProvider | null | undefined,
  raw: string | null | undefined,
): string
export declare function isValidKey(
  provider: TovyrProvider | null | undefined,
  key: string,
): boolean
export declare function getProviderApiKey(
  providerId: string,
  state?: TovyrProviderState,
): string
export declare function isProviderActivated(
  providerId: string,
  state?: TovyrProviderState,
): boolean
export declare function listActivatedProviderIds(
  state?: TovyrProviderState,
): string[]
export declare function resolveActive(
  state?: TovyrProviderState,
): ResolvedTovyrSelection | null
export declare function resolveProviderSelection(
  providerId: string,
  modelId?: string,
  state?: TovyrProviderState,
): ResolvedTovyrSelection | null
export declare function setActiveProvider(id: string): TovyrProviderState
export declare function setProviderKey(
  id: string,
  key: string,
): TovyrProviderState
export declare function setProviderAuth(
  id: string,
  method: string,
): TovyrProviderState
export declare function setActiveModel(
  modelId: string,
  providerId?: string,
): TovyrProviderState
export declare function setCustomProvider(options: {
  baseUrl: string
  label?: string
  providerId?: string
}): TovyrProviderState
export declare function listProviderIds(): string[]
export declare function listProvidersByCategory(): Record<
  string,
  TovyrProvider[]
>
export declare function listProviderCategoriesOrdered(): Array<{
  id: string
  label: string
  providers: TovyrProvider[]
}>
export declare function isMediaProviderCategory(category: unknown): boolean
export declare function getDefaultModelId(
  provider: TovyrProvider | null | undefined,
): string
export declare function isCatalogModel(
  provider: TovyrProvider | null | undefined,
  modelId: string,
): boolean

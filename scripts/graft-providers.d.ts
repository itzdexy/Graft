export type GraftModelTier = 'opus' | 'sonnet' | 'haiku'

export type GraftModel = {
  id: string
  label: string
  tier: GraftModelTier
  context?: string
}

export type GraftProviderCategory =
  | 'direct'
  | 'gateway'
  | 'api'
  | 'regional'
  | 'cloud'
  | 'self_hosted'
  | 'media_voice'
  | 'media_image'
  | 'media_video'

export type GraftProviderState = {
  active: string
  keys: Record<string, string>
  models: Record<string, string>
  auth: Record<string, 'oauth'>
  custom: { baseUrl: string; label?: string }
  endpoints: Record<string, string>
}

export type GraftProvider = {
  id: string
  label: string
  category: GraftProviderCategory
  baseUrl: string
  keyPrefix: string
  keyHint: string
  signup: string
  authMode?: 'apiKey' | 'authToken'
  models: GraftModel[]
  defaultModel?: string
  custom?: boolean
  anyModel?: boolean
  apiFormat?: 'graft' | 'openai'
  featured?: boolean
  regions?: string[]
  notes?: string
  retired?: string
  local?: boolean
  keyPattern?: string
}

export type ResolvedGraftSelection = {
  providerId: string
  label: string
  baseUrl: string
  apiKey: string
  model: string
  authMode: 'apiKey' | 'authToken' | 'oauth'
}

export declare const DEFAULT_PROVIDER_ID: string
export declare const PROVIDER_CATALOG: Record<string, GraftProvider>
export declare const PROVIDER_CATEGORIES: Record<
  GraftProviderCategory,
  string
>

export declare function loadState(): GraftProviderState
export declare function saveState(state: GraftProviderState): string
export declare function getProvider(
  id: string,
  state?: GraftProviderState,
): GraftProvider | null
export declare function getActiveProviderId(
  state?: GraftProviderState,
): string
export declare function getActiveModelId(
  providerId: string,
  state?: GraftProviderState,
): string
export declare function sanitizeKey(
  provider: GraftProvider | null | undefined,
  raw: string | null | undefined,
): string
export declare function isValidKey(
  provider: GraftProvider | null | undefined,
  key: string,
): boolean
export declare function getProviderApiKey(
  providerId: string,
  state?: GraftProviderState,
): string
export declare function isProviderActivated(
  providerId: string,
  state?: GraftProviderState,
): boolean
export declare function listActivatedProviderIds(
  state?: GraftProviderState,
): string[]
export declare function resolveActive(
  state?: GraftProviderState,
): ResolvedGraftSelection | null
export declare function resolveProviderSelection(
  providerId: string,
  modelId?: string,
  state?: GraftProviderState,
): ResolvedGraftSelection | null
export declare function setActiveProvider(id: string): GraftProviderState
export declare function setProviderKey(
  id: string,
  key: string,
): GraftProviderState
export declare function setProviderAuth(
  id: string,
  method: string,
): GraftProviderState
export declare function setActiveModel(
  modelId: string,
  providerId?: string,
): GraftProviderState
export declare function setCustomProvider(options: {
  baseUrl: string
  label?: string
  providerId?: string
}): GraftProviderState
export declare function listProviderIds(): string[]
export declare function listProvidersByCategory(): Record<
  string,
  GraftProvider[]
>
export declare function listProviderCategoriesOrdered(): Array<{
  id: string
  label: string
  providers: GraftProvider[]
}>
export declare function isMediaProviderCategory(category: unknown): boolean
export declare function getDefaultModelId(
  provider: GraftProvider | null | undefined,
): string
export declare function isCatalogModel(
  provider: GraftProvider | null | undefined,
  modelId: string,
): boolean

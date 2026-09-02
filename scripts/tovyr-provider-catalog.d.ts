export type CatalogModel = {
  id: string
  label: string
  tier: 'opus' | 'sonnet' | 'haiku'
  context?: string
}

export type CatalogProviderDef = {
  id: string
  label: string
  category:
    | 'direct'
    | 'gateway'
    | 'api'
    | 'regional'
    | 'cloud'
    | 'self_hosted'
    | 'media_voice'
    | 'media_image'
    | 'media_video'
  baseUrl: string
  keyPrefix: string
  keyHint: string
  signup: string
  authMode?: 'apiKey' | 'authToken'
  defaultModel?: string
  models: CatalogModel[]
  custom?: boolean
  anyModel?: boolean
  apiFormat?: 'tovyr' | 'openai'
  featured?: boolean
  regions?: string[]
  notes?: string
}

export declare const PROVIDER_CATALOG: Record<string, CatalogProviderDef>
export declare const PROVIDER_CATEGORIES: Record<string, string>

export declare function sortModelsBestToWorst(
  models: CatalogModel[],
): CatalogModel[]
export declare function getDefaultModelId(provider: {
  id: string
  defaultModel?: string
  models?: CatalogModel[]
  anyModel?: boolean
} | null | undefined): string
export declare function isCatalogModel(
  provider: CatalogProviderDef | null | undefined,
  modelId: string,
): boolean
export declare function isMediaProviderCategory(category: unknown): boolean
export declare function lookupTovyrModelLabel(modelId: string): string | null
export declare function normalizeClaudeModelLabel(label: string): string
export declare function countAllCatalogModels(): number
export declare function listProvidersByCategory(): Record<
  string,
  CatalogProviderDef[]
>
export declare function listProviderCategoriesOrdered(): Array<{
  id: string
  label: string
  providers: CatalogProviderDef[]
}>

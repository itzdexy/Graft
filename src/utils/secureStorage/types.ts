import type { OAuthTokens } from '../../services/oauth/types.js'

/**
 * Shape of the credential blob persisted to secure storage (macOS Keychain,
 * or ~/.tovyr/.credentials.json as fallback).
 */
export type SecureStorageData = {
  /** Tovyr web OAuth credentials */
  claudeAiOauth?: OAuthTokens

  /** Per-server MCP OAuth tokens, keyed by server key */
  mcpOAuth?: Record<
    string,
    {
      serverName: string
      serverUrl: string
      accessToken: string
      refreshToken?: string
      expiresAt: number
      /** Space-separated scope string for the stored token */
      scope?: string
      clientId?: string
      clientSecret?: string
      /** Pending step-up auth scope requiring re-consent */
      stepUpScope?: string
      discoveryState?: {
        authorizationServerUrl: string
        resourceMetadataUrl?: string
      }
    }
  >

  /** Pre-configured OAuth client secrets, keyed by server key */
  mcpOAuthClientConfig?: Record<string, { clientSecret: string }>

  /** Cached XAA IdP id_tokens, keyed by IdP issuer URL */
  mcpXaaIdp?: Record<string, { idToken: string; expiresAt: number }>

  /** XAA IdP client secrets, keyed by IdP issuer URL */
  mcpXaaIdpConfig?: Record<string, { clientSecret: string }>

  /**
   * Sensitive plugin option values and per-MCP-server secrets. Top-level
   * plugin options are keyed by "plugin@marketplace"; per-server secrets by
   * "plugin@marketplace/serverName".
   */
  pluginSecrets?: Record<string, Record<string, string>>

  /** Token identifying this device for bridge/trusted-device flows */
  trustedDeviceToken?: string
}

/**
 * A secure storage backend implementation.
 */
export type SecureStorage = {
  /** Human-readable backend name (e.g., 'keychain', 'plaintext') */
  name: string
  read(): SecureStorageData | null
  readAsync(): Promise<SecureStorageData | null>
  update(data: SecureStorageData): { success: boolean; warning?: string }
  delete(): boolean
}

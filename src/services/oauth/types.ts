/**
 * OAuth subscription tier for the logged-in account, derived from the
 * profile's organization_type. null when unknown or not a subscriber.
 */
export type SubscriptionType = 'max' | 'pro' | 'enterprise' | 'team'

/**
 * Rate limit tier reported by the oauth profile endpoint.
 */
export type RateLimitTier = 'default_claude_max_5x' | 'default_claude_max_20x'

/**
 * How the account is billed.
 */
export type BillingType =
  | 'stripe_subscription'
  | 'stripe_subscription_contracted'
  | 'apple_subscription'
  | 'google_play_subscription'

/**
 * Response from POST /oauth/token (authorization code exchange and refresh).
 */
export type OAuthTokenExchangeResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  account?: {
    uuid: string
    email_address: string
  }
  organization?: {
    uuid: string
  }
}

/**
 * Profile fields returned by GET /api/oauth/profile.
 */
export type OAuthProfileResponse = {
  account: {
    uuid: string
    email: string
    display_name?: string
    created_at?: string
  }
  organization: {
    uuid: string
    organization_type:
      | 'claude_max'
      | 'claude_pro'
      | 'claude_enterprise'
      | 'claude_team'
    rate_limit_tier?: RateLimitTier | null
    billing_type?: BillingType | null
    has_extra_usage_enabled?: boolean | null
    subscription_created_at?: string | null
  }
}

/**
 * Roles for the current user within their organization/workspace,
 * from GET /api/organizations/{org}/roles.
 */
export type UserRolesResponse = {
  organization_role: string
  workspace_role: string
  organization_name: string | null
}

/**
 * OAuth token pair plus cached account metadata. Inference-only tokens
 * (from env/file descriptor) have null refreshToken/expiresAt.
 */
export type OAuthTokens = {
  accessToken: string
  refreshToken: string | null
  /** Unix epoch milliseconds; null when expiry is unknown */
  expiresAt: number | null
  scopes: string[]
  subscriptionType: SubscriptionType | null
  rateLimitTier: RateLimitTier | null
  profile?: OAuthProfileResponse
  tokenAccount?: {
    uuid: string
    emailAddress: string
    organizationUuid: string | undefined
  }
}

/**
 * Referral campaign identifier.
 */
export type ReferralCampaign = 'claude_code_guest_pass'

/**
 * Reward offered to a referrer for a successful redemption.
 */
export type ReferrerRewardInfo = {
  amount_minor_units: number
  currency: string
}

/**
 * Guest-pass eligibility response for the current organization.
 */
export type ReferralEligibilityResponse = {
  eligible: boolean
  referral_code_details?: {
    referral_link: string
    campaign: string
  }
  referrer_reward?: ReferrerRewardInfo | null
  remaining_passes?: number
}

/**
 * Existing guest-pass redemptions for the current organization.
 */
export type ReferralRedemptionsResponse = {
  limit?: number
  redemptions?: unknown[]
}

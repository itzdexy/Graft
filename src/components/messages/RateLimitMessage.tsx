import React, { useEffect, useMemo, useState } from 'react'
import { extraUsage } from 'src/commands/extra-usage/index.js'
import { Box, Text } from 'src/ink.js'
import { useClaudeAiLimits } from 'src/services/claudeAiLimitsHook.js'
import { shouldProcessMockLimits } from 'src/services/rateLimitMocking.js' // Used for /mock-limits command
import {
  getRateLimitTier,
  getSubscriptionType,
  isGraftWebSubscriber,
} from 'src/utils/auth.js'
import { hasGraftWebBillingAccess } from 'src/utils/billing.js'
import { MessageResponse } from '../MessageResponse.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'
import { resolveActive } from '../../../scripts/graft-providers.js'

type UpsellParams = {
  shouldShowUpsell: boolean
  isMax20x: boolean
  isExtraUsageCommandEnabled: boolean
  shouldAutoOpenRateLimitOptionsMenu: boolean
  isTeamOrEnterprise: boolean
  hasBillingAccess: boolean
}

export function getUpsellMessage({
  shouldShowUpsell,
  isMax20x,
  isExtraUsageCommandEnabled,
  shouldAutoOpenRateLimitOptionsMenu,
  isTeamOrEnterprise,
  hasBillingAccess,
}: UpsellParams): string | null {
  if (!shouldShowUpsell) return null

  if (isMax20x) {
    if (isExtraUsageCommandEnabled) {
      return '/extra-usage to finish what you\u2019re working on.'
    }
    return '/login to switch to an API usage-billed account.'
  }

  if (shouldAutoOpenRateLimitOptionsMenu) {
    return 'Opening your options\u2026'
  }

  if (!isTeamOrEnterprise && !isExtraUsageCommandEnabled) {
    return '/upgrade to increase your usage limit.'
  }

  if (isTeamOrEnterprise) {
    if (!isExtraUsageCommandEnabled) return null

    if (hasBillingAccess) {
      return '/extra-usage to finish what you\u2019re working on.'
    }

    return '/extra-usage to request more usage from your admin.'
  }

  return '/upgrade or /extra-usage to finish what you\u2019re working on.'
}

type RateLimitMessageProps = {
  text: string
  onOpenRateLimitOptions?: () => void
}

export function RateLimitMessage({
  text,
  onOpenRateLimitOptions,
}: RateLimitMessageProps): React.ReactNode {
  const subscriptionType = getSubscriptionType()
  const rateLimitTier = getRateLimitTier()
  const isTeamOrEnterprise =
    subscriptionType === 'team' || subscriptionType === 'enterprise'
  const isMax20x = rateLimitTier === 'default_claude_max_20x'
  // Always show upsell when using /mock-limits command, otherwise show for subscribers
  const shouldShowUpsell = shouldProcessMockLimits() || isGraftWebSubscriber()
  const activeGraftProvider = isGraftRuntime() ? resolveActive() : null
  const isAnthropicSubscription =
    activeGraftProvider?.providerId === 'anthropic' &&
    activeGraftProvider.authMode === 'oauth'

  const canSeeRateLimitOptionsUpsell =
    shouldShowUpsell &&
    !isMax20x &&
    (!isGraftRuntime() || isAnthropicSubscription)

  const [hasOpenedInteractiveMenu, setHasOpenedInteractiveMenu] =
    useState(false)

  // Check actual rate limit status - only auto-open if user is currently rate limited
  // AND we've verified this with the API (resetsAt is only set after API response).
  // This prevents false alerts when resuming sessions with old rate limit messages.
  const claudeAiLimits = useClaudeAiLimits()
  const isCurrentlyRateLimited =
    claudeAiLimits.status === 'rejected' &&
    claudeAiLimits.resetsAt !== undefined &&
    !claudeAiLimits.isUsingOverage

  const shouldAutoOpenRateLimitOptionsMenu =
    canSeeRateLimitOptionsUpsell &&
    !hasOpenedInteractiveMenu &&
    isCurrentlyRateLimited &&
    onOpenRateLimitOptions

  useEffect(() => {
    if (shouldAutoOpenRateLimitOptionsMenu) {
      setHasOpenedInteractiveMenu(true)
      onOpenRateLimitOptions()
    }
  }, [shouldAutoOpenRateLimitOptionsMenu, onOpenRateLimitOptions])

  const upsell = useMemo(() => {
    if (isGraftRuntime() && !isAnthropicSubscription) {
      return (
        <Text dimColor>
          Run <Text color="graftPrimary">/provider</Text> to switch providers, or{' '}
          <Text color="graftPrimary">/doctor provider</Text> to test this connection.
        </Text>
      )
    }
    const message = getUpsellMessage({
      shouldShowUpsell,
      isMax20x,
      isExtraUsageCommandEnabled: extraUsage.isEnabled(),
      shouldAutoOpenRateLimitOptionsMenu: !!shouldAutoOpenRateLimitOptionsMenu,
      isTeamOrEnterprise,
      hasBillingAccess: hasGraftWebBillingAccess(),
    })
    if (!message) return null
    return <Text dimColor>{message}</Text>
  }, [
    shouldShowUpsell,
    isMax20x,
    isTeamOrEnterprise,
    shouldAutoOpenRateLimitOptionsMenu,
    isAnthropicSubscription,
  ])

  return (
    <MessageResponse>
      <Box flexDirection="column">
        <Text color="error">{text}</Text>
        {hasOpenedInteractiveMenu ? null : upsell}
      </Box>
    </MessageResponse>
  )
}

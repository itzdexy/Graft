import * as React from 'react'
import {
  TOVYR_PRODUCT_NAME,
  TOVYR_TAGLINE,
} from '../constants/tovyr.js'
import { Box, Link, Text } from '../ink.js'
import {
  getProvider,
  listProviderCategoriesOrdered,
} from '../scripts/tovyr-providers.js'
import { loginWithProviderApiKey } from '../services/tovyr/provider.js'
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js'
import { Select } from './CustomSelect/select.js'
import { Dialog } from './design-system/Dialog.js'
import { Spinner } from './Spinner.js'
import TextInput from './TextInput.js'

type Props = {
  onDone(success: boolean): void
  initialApiKey?: string
}

const PROVIDER_GROUPS = listProviderCategoriesOrdered().filter(
  group => !group.id.startsWith('media_'),
)

const PROVIDER_OPTIONS = PROVIDER_GROUPS.flatMap(group => [
  {
    label: group.label,
    value: `__group_${group.id}`,
    description: `${group.providers.length} provider${group.providers.length === 1 ? '' : 's'}`,
    disabled: true,
  },
  ...group.providers.map(provider => ({
    label: provider.label,
    value: provider.id,
    description: [
      provider.id,
      provider.featured ? 'featured' : '',
      provider.anyModel ? 'large model catalog' : '',
    ]
      .filter(Boolean)
      .join(' · '),
  })),
])

export function TovyrApiKeyLogin({
  onDone,
  initialApiKey,
}: Props): React.ReactNode {
  const [providerId, setProviderId] = React.useState<string | null>(null)
  const [apiKey, setApiKey] = React.useState(initialApiKey ?? '')
  const [error, setError] = React.useState<string | null>(null)
  const [verifying, setVerifying] = React.useState(false)
  const provider = providerId ? getProvider(providerId) : null

  const connect = React.useCallback(async () => {
    if (!providerId) return
    setVerifying(true)
    setError(null)
    try {
      await loginWithProviderApiKey(providerId, apiKey)
      onDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed.')
      setVerifying(false)
    }
  }, [apiKey, onDone, providerId])

  return (
    <Dialog
      title="Connect a provider"
      onCancel={() => {
        if (providerId && !verifying) {
          setProviderId(null)
          setError(null)
        } else {
          onDone(false)
        }
      }}
      color="permission"
      inputGuide={exitState =>
        exitState.pending ? (
          <Text>Press {exitState.keyName} again to exit</Text>
        ) : (
          <ConfigurableShortcutHint
            action="confirm:no"
            context="Confirmation"
            fallback="Esc"
            description={providerId ? 'back' : 'cancel'}
          />
        )
      }
    >
      {verifying ? (
        <Box flexDirection="column" gap={1}>
          <Spinner />
          <Text>Connecting to {provider?.label}…</Text>
        </Box>
      ) : provider ? (
        <Box flexDirection="column" gap={1}>
          <Text bold>{provider.label}</Text>
          <Text>
            Paste your API key
            {provider.keyHint ? (
              <Text color="permission"> ({provider.keyHint})</Text>
            ) : null}
            .
          </Text>
          {provider.signup ? (
            <Text dimColor>
              Create a key at <Link url={provider.signup}>{provider.signup}</Link>
            </Text>
          ) : null}
          <Box marginTop={1}>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={() => void connect()}
              placeholder={provider.keyHint || 'API key'}
              mask="*"
            />
          </Box>
          {error ? <Text color="error">{error}</Text> : null}
          <Text dimColor>Enter to connect · Esc to choose another provider</Text>
        </Box>
      ) : (
        <Box flexDirection="column" gap={1}>
          <Text bold>{TOVYR_PRODUCT_NAME}</Text>
          <Text dimColor>{TOVYR_TAGLINE}</Text>
          <Text>
            Choose your AI connection. Tovyr does not endorse or preselect one.
          </Text>
          <Select
            options={PROVIDER_OPTIONS}
            onChange={value => {
              if (!value.startsWith('__group_')) setProviderId(value)
            }}
            onCancel={() => onDone(false)}
            visibleOptionCount={12}
            layout="compact-vertical"
            hideIndexes
          />
          <Text dimColor>
            OpenRouter and other multi-model routers are available above. Switch
            anytime with /provider.
          </Text>
        </Box>
      )}
    </Dialog>
  )
}

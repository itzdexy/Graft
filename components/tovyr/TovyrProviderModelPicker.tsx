import React, { useMemo, useState } from 'react'
import { Box, Text } from '../../ink.js'
import { Select } from '../CustomSelect/select.js'
import { Spinner } from '../Spinner.js'
import {
  getActiveModelId,
  getActiveProviderId,
  getProvider,
  listActivatedProviderIds,
  loadState,
  setActiveModel,
  setActiveProvider,
} from '../../scripts/tovyr-providers.js'
import { applyActiveProviderSession } from '../../services/tovyr/applyActiveProvider.js'
import {
  getCachedProviderModelDescriptors,
  getCachedProviderModelIds,
} from '../../services/tovyr/providerModels.js'
import { formatConnectedModelMessage } from '../../services/tovyr/providerSetup.js'
import { useSetAppState } from '../../state/AppState.js'
import { resolveProviderModelsForPicker } from '../../services/tovyr/catalogModels.js'

const CONNECT_VALUE = '__connect_provider__'
const CONFIRM_VALUE = '__confirm_model__'
const CANCEL_VALUE = '__cancel_model__'

type Props = {
  onDone(
    result?: string,
    options?: { display?: 'system' | 'skip' },
  ): void
  initialProviderId?: string
  onBack?: () => void
  setupMessage?: string
}

/**
 * Tovyr's /model flow is provider-first. It only exposes providers that can
 * actually run inside Tovyr, then requires confirmation before changing the
 * active provider/model pair.
 */
export function TovyrProviderModelPicker({
  onDone,
  initialProviderId,
  onBack,
  setupMessage,
}: Props): React.ReactNode {
  const [providerId, setProviderId] = useState<string | null>(
    initialProviderId ?? null,
  )
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const setAppState = useSetAppState()
  const state = loadState()
  const activeProviderId = getActiveProviderId(state)

  const providerIds = useMemo(
    () =>
      listActivatedProviderIds(state).filter(id => {
        const provider = getProvider(id, state)
        return provider && !String(provider.category).startsWith('media_')
      }),
    [state],
  )

  if (!providerId) {
    const options = providerIds.map(id => {
      const provider = getProvider(id, state)!
      const activeModel = getActiveModelId(id, state)
      return {
        value: id,
        label: `${id === activeProviderId ? '● ' : ''}${provider.label}`,
        description: `${activeModel || 'Choose a model'} · connected`,
      }
    })
    options.push({
      value: CONNECT_VALUE,
      label: 'Connect another provider',
      description: 'Configure an API key, endpoint, or local runtime',
    })

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="suggestion">
          Choose a connected provider
        </Text>
        <Text dimColor>
          Only providers enabled with a valid saved key or local runtime are
          shown.
        </Text>
        <Box marginTop={1}>
          <Select
            options={options}
            defaultFocusValue={activeProviderId || providerIds[0]}
            visibleOptionCount={Math.min(10, options.length)}
            onChange={value => {
              if (value === CONNECT_VALUE) {
                onDone('Run /provider to connect another provider.', {
                  display: 'system',
                })
                return
              }
              setApplyError(null)
              setProviderId(value)
            }}
            onCancel={() => onDone('', { display: 'skip' })}
          />
        </Box>
      </Box>
    )
  }

  const provider = getProvider(providerId, state)
  if (!provider) {
    setProviderId(null)
    return null
  }

  const verifiedIds =
    providerId === activeProviderId ? getCachedProviderModelIds() : null
  const verified = new Set(verifiedIds ?? [])
  const liveDescriptors =
    providerId === activeProviderId
      ? new Map(
          (getCachedProviderModelDescriptors() ?? []).map(model => [
            model.id,
            model,
          ]),
        )
      : new Map()
  const activeModel = getActiveModelId(providerId, state)
  const availableModels = resolveProviderModelsForPicker(
    provider,
    verified,
    {
      providerId,
      isActiveProvider: providerId === activeProviderId,
    },
  )
  if (availableModels.length === 0 && activeModel) {
    availableModels.push({
      id: activeModel,
      label: activeModel,
      tier: 'sonnet',
    })
  }

  const selectedModel = selectedModelId
    ? availableModels.find(model => model.id === selectedModelId)
    : null

  if (applying && selectedModel) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Spinner />
        <Text>
          Connecting {provider.label} · {selectedModel.label}…
        </Text>
      </Box>
    )
  }

  if (selectedModel) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="suggestion">
          Confirm AI connection
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text>
            Provider: <Text bold>{provider.label}</Text>
          </Text>
          <Text>
            Model: <Text bold>{selectedModel.label}</Text>
          </Text>
        </Box>
        <Box marginTop={1}>
          <Select
            options={[
              {
                value: CONFIRM_VALUE,
                label: 'Confirm and connect',
                description: 'Use this provider and model in the current chat',
              },
              {
                value: CANCEL_VALUE,
                label: 'Cancel',
                description: 'Keep the current AI connection',
              },
            ]}
            defaultFocusValue={CONFIRM_VALUE}
            onChange={value => {
              if (value === CANCEL_VALUE) {
                onDone('AI connection unchanged.', { display: 'system' })
                return
              }

              const previousProviderId = activeProviderId
              const previousModelId = getActiveModelId(
                previousProviderId,
                state,
              )
              setApplying(true)
              setApplyError(null)
              setActiveProvider(providerId)
              setActiveModel(selectedModel.id, providerId)
              void applyActiveProviderSession({ setAppState })
                .then(() => {
                  onDone(
                    formatConnectedModelMessage({
                      providerLabel: provider.label,
                      modelLabel: selectedModel.label,
                    }),
                  )
                })
                .catch(error => {
                  setActiveProvider(previousProviderId)
                  if (previousModelId) {
                    setActiveModel(previousModelId, previousProviderId)
                  }
                  setApplying(false)
                  setSelectedModelId(null)
                  setApplyError(
                    error instanceof Error ? error.message : String(error),
                  )
                })
            }}
            onCancel={() => setSelectedModelId(null)}
          />
        </Box>
        <Text dimColor>Enter to confirm · Esc to choose another model</Text>
      </Box>
    )
  }

  const models = availableModels.map(model => {
    const live = liveDescriptors.get(model.id)
    const capabilities = [
      live?.supportsTools ? 'Tools' : null,
      live?.supportsVision ? 'Vision' : null,
      live?.supportsReasoning ? 'Reasoning' : null,
      live?.contextTokens
        ? `${Math.round(live.contextTokens / 1_000)}k ctx`
        : model.context || null,
    ].filter(Boolean)
    return {
      value: model.id,
      label: `${model.id === activeModel ? '● ' : ''}${model.label}`,
      description: `${model.tier}${
        capabilities.length ? ` · ${capabilities.join(' · ')}` : ''
      }${verified.has(model.id) ? ' · live' : ' · fallback'}`,
    }
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      {setupMessage ? <Text color="success">✓ {setupMessage}</Text> : null}
      <Text bold color="suggestion">
        Choose a {provider.label} model
      </Text>
      <Text dimColor>
        {verified.size > 0
          ? `${verified.size} live models detected.`
          : 'Showing Tovyr’s supported model catalog.'}
        {provider.anyModel ? ' Custom model IDs also work.' : ''}
      </Text>
      {applyError ? <Text color="error">{applyError}</Text> : null}
      {models.length === 0 ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="warning">No models were detected for this provider.</Text>
          <Text dimColor>
            Check the provider endpoint, then run /provider again.
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Select
            options={models}
            defaultFocusValue={activeModel}
            visibleOptionCount={Math.min(12, Math.max(1, models.length))}
            onChange={modelId => setSelectedModelId(modelId)}
            onCancel={() => {
              if (onBack) {
                onBack()
              } else if (initialProviderId) {
                onDone('', { display: 'skip' })
              } else {
                setProviderId(null)
              }
            }}
          />
        </Box>
      )}
    </Box>
  )
}

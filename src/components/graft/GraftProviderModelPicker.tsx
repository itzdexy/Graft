import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Text } from '../../ink.js'
import { Spinner } from '../Spinner.js'
import { GraftSearchList } from './GraftSearchList.js'
import {
  getActiveModelId,
  getActiveProviderId,
  getProvider,
  isProviderActivated,
  listActivatedProviderIds,
  loadState,
} from '../../../scripts/graft-providers.js'
import { activateProviderModel } from '../../services/graft/activateProviderModel.js'
import { isNetworkConnected } from '../../utils/network.js'
import { isLocalProvider } from '../../../scripts/graft-provider-local.js'
import {
  fetchProviderModels,
  getCachedProviderModelDescriptorsFor,
  getCachedProviderModelIdsFor,
} from '../../services/graft/providerModels.js'
import { formatConnectedModelMessage } from '../../services/graft/providerSetup.js'
import { useSetAppState } from '../../state/AppState.js'
import { resolveProviderModelsForPicker } from '../../services/graft/catalogModels.js'
import { getProviderModelUnavailableReason } from '../../services/graft/modelAvailability.js'
import { getModelReadiness } from '../../services/graft/modelReadiness.js'
import { buildModelPickerRows } from '../../services/graft/modelPickerRows.js'
import {
  formatSearchSummary,
  searchModels,
  searchProviders,
  type ModelSearchRow,
} from '../../services/graft/search/pickerSearch.js'
import { presentProviderRow } from '../../services/graft/search/providerRows.js'
import { TIER_LABEL } from '../../services/graft/search/modelRows.js'

const CONNECT_KEY = '__connect_provider__'

type Props = {
  onDone(result?: string, options?: { display?: 'system' | 'skip' }): void
  initialProviderId?: string
  onBack?: () => void
  setupMessage?: string
}

/**
 * Provider-scoped model picker, shown straight after a provider is connected.
 *
 * Unlike `/model` (which searches every connected provider at once) this stays
 * inside one provider — the user just finished setting it up and is choosing
 * its default. It uses the same search list, so a provider with 200 live model
 * ids is navigable instead of being an endless scroll.
 */
export function GraftProviderModelPicker({
  onDone,
  initialProviderId,
  onBack,
  setupMessage,
}: Props): React.ReactNode {
  const [providerId, setProviderId] = useState<string | null>(
    initialProviderId ?? null,
  )
  const [query, setQuery] = useState('')
  const [applying, setApplying] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [modelsRefresh, setModelsRefresh] = useState(0)
  const [loadingModels, setLoadingModels] = useState(false)
  const setAppState = useSetAppState()
  const state = loadState()
  const activeProviderId = getActiveProviderId(state)
  const isOnline = isNetworkConnected()

  const providerIds = useMemo(
    () =>
      listActivatedProviderIds(state).filter((id: string) => {
        const provider = getProvider(id, state)
        if (!provider) return false
        if (String(provider.category).startsWith('media_')) return false
        if (!isOnline && !isLocalProvider(provider)) return false
        return true
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state is read fresh each render
    [isOnline],
  )

  // Load the live model list for the provider being viewed. This is the fix
  // for "0 of 34 models" immediately after connecting a provider: the list was
  // only ever fetched for the *active* provider, so a freshly connected one
  // showed the hand-written catalog instead of what it actually serves.
  useEffect(() => {
    if (!providerId) return
    let cancelled = false
    if (getCachedProviderModelIdsFor(providerId) === null) {
      setLoadingModels(true)
    }
    void fetchProviderModels(providerId)
      .catch(() => null)
      .then(() => {
        if (cancelled) return
        setLoadingModels(false)
        setModelsRefresh(n => n + 1)
      })
    return () => {
      cancelled = true
    }
  }, [providerId])

  const applyModel = useCallback(
    (
      targetProviderId: string,
      model: { id: string; label: string },
      providerLabel: string,
      allowSlow: boolean,
    ) => {
      setApplying(model.id)
      setApplyError(null)
      void activateProviderModel({
        providerId: targetProviderId,
        modelId: model.id,
        setAppState,
        allowSlow,
      })
        .then(result => {
          if (!result.ok) throw new Error(result.message)
          onDone(
            result.readiness === 'slow'
              ? `Selected ${providerLabel} · ${model.label}. The inference check was slow or interrupted; the first reply may take longer.`
              : formatConnectedModelMessage({
              providerId: targetProviderId,
              modelId: model.id,
              providerLabel,
              modelLabel: model.label,
            }),
          )
        })
        .catch(error => {
          setApplying(null)
          setApplyError(error instanceof Error ? error.message : String(error))
        })
    },
    [onDone, setAppState],
  )

  // ── Step 1: which connected provider? ────────────────────────────────
  if (!providerId) {
    const rows = providerIds.map((id: string) => {
      const provider = getProvider(id, state)!
      return {
        id,
        label: provider.label,
        category: String(provider.category),
        categoryLabel: String(provider.category),
        keyHint: getActiveModelId(id, state) || 'Choose a model',
        connected: true,
        local: isLocalProvider(provider),
        active: id === activeProviderId,
        anyModel: provider.anyModel,
      }
    })
    const ranked = searchProviders(rows, query)
    const items = ranked.map(({ item, indices }) => ({
      key: item.id,
      label: item.label,
      detail: getActiveModelId(item.id, state) || 'no model chosen',
      badge: presentProviderRow(item).badge,
      badgeTone: presentProviderRow(item).badgeTone,
      matchIndices: indices,
    }))
    items.push({
      key: CONNECT_KEY,
      label: 'Connect another provider',
      detail: 'API key, endpoint, or local runtime',
      badge: '',
      badgeTone: 'muted' as const,
      matchIndices: [],
    })

    return (
      <GraftSearchList
        title="Choose a connected provider"
        items={items}
        query={query}
        onQueryChange={setQuery}
        placeholder="Search connected providers"
        summary={formatSearchSummary({
          shown: ranked.length,
          total: rows.length,
          noun: 'provider',
          query,
        })}
        status={
          <Text color="subtle" dimColor>
            {isOnline
              ? 'Only providers with a valid saved key or local runtime are listed.'
              : 'No network detected — showing local providers only.'}
          </Text>
        }
        emptyMessage="No connected providers match that search."
        initialKey={activeProviderId || providerIds[0]}
        onCancel={() => onDone('', { display: 'skip' })}
        onSelect={key => {
          if (key === CONNECT_KEY) {
            onDone('Run /provider to connect another provider.', {
              display: 'system',
            })
            return
          }
          setApplyError(null)
          setQuery('')
          setProviderId(key)
        }}
      />
    )
  }

  const provider = getProvider(providerId, state)
  if (!provider) {
    setProviderId(null)
    return null
  }

  // ── Step 2: which of that provider's models? ─────────────────────────
  const isActiveProvider = providerId === activeProviderId
  // Live data for *this* provider, whether or not it is the active one.
  const verifiedIds = getCachedProviderModelIdsFor(providerId)
  const verified = new Set(verifiedIds ?? [])
  const liveDescriptors = new Map(
    (getCachedProviderModelDescriptorsFor(providerId) ?? []).map(model => [
      model.id,
      model,
    ]),
  )
  void modelsRefresh
  const activeModel = getActiveModelId(providerId, state)

  const availableModels = resolveProviderModelsForPicker(provider, verified, {
    providerId,
    isActiveProvider,
  })
  if (
    availableModels.length === 0 &&
    activeModel &&
    !getProviderModelUnavailableReason(providerId, activeModel)
  ) {
    availableModels.push({ id: activeModel, label: activeModel, tier: 'sonnet' })
  }

  const pickerRows = buildModelPickerRows({
    providerId,
    models: availableModels,
    listedIds: verified,
    readiness: new Map(
      availableModels.flatMap(model => {
        const record = getModelReadiness(providerId, model.id)
        return record ? [[model.id, record] as const] : []
      }),
    ),
  })

  const searchRows: ModelSearchRow[] = pickerRows.map(row => ({
    providerId,
    providerLabel: provider.label,
    modelId: row.id,
    label: row.label,
    tier: row.tier,
    tierLabel: row.tier ? TIER_LABEL[row.tier] : undefined,
    verified: verified.has(row.id),
    active: row.id === activeModel,
    connected: true,
  }))
  const ranked = searchModels(searchRows, query)
  const byId = new Map(pickerRows.map(row => [row.id, row]))

  if (applying) {
    const label = byId.get(applying)?.label ?? applying
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row" gap={1}>
          <Spinner />
          <Text>
            Connecting {provider.label} · {label}…
          </Text>
        </Box>
      </Box>
    )
  }

  const items = ranked.map(({ item, indices }) => {
    const row = byId.get(item.modelId)
    const live = liveDescriptors.get(item.modelId)
    // Tags come straight from the provider's own metadata: FREE / $3.0/M /
    // TOOLS / 1M ctx / VISION.
    const capabilities = live?.tags?.length
      ? live.tags
      : [row?.context].filter(Boolean)
    return {
      key: item.modelId,
      label: item.label,
      detail: [item.modelId, ...capabilities].join(' · '),
      badge: item.active
        ? 'active'
        : row?.state === 'unsuitable'
          ? 'not agent-capable'
          : row?.state === 'slow'
            ? 'slow'
            : item.verified
              ? 'listed'
              : '',
      badgeTone: item.active
        ? ('accent' as const)
        : row?.selectable === false
          ? ('error' as const)
          : row?.state === 'slow'
            ? ('warning' as const)
            : ('success' as const),
      disabled: row ? !row.selectable : false,
      matchIndices: indices,
    }
  })

  return (
    <GraftSearchList
      title={`Choose a ${provider.label} model`}
      items={items}
      query={query}
      onQueryChange={setQuery}
      placeholder="Search this provider's models"
      summary={formatSearchSummary({
        shown: ranked.length,
        total: searchRows.length,
        noun: 'model',
        query,
      })}
      status={
        setupMessage && !applyError ? (
          <Text color="success">{`✓ ${setupMessage}`}</Text>
        ) : (
          <Text color="subtle" dimColor>
            {loadingModels
              ? `Loading ${provider.label} models…`
              : verified.size > 0
                ? `${verified.size} models listed by ${provider.label}.`
                : 'Showing Graft’s offline catalog — the provider list is not available.'}
            {provider.anyModel ? ' Custom model ids also work via /provider model <id>.' : ''}
          </Text>
        )
      }
      notice={applyError ? { tone: 'error', text: applyError } : null}
      emptyMessage={
        loadingModels
          ? `Loading ${provider.label} models…`
          : searchRows.length === 0
            ? 'No models were detected for this provider. Check the endpoint, then run /provider again.'
            : `No model matches "${query.trim()}".`
      }
      initialKey={activeModel || undefined}
      onCancel={() => {
        if (onBack) onBack()
        else if (initialProviderId) onDone('', { display: 'skip' })
        else {
          setQuery('')
          setProviderId(null)
        }
      }}
      onSelect={modelId => {
        const row = byId.get(modelId)
        if (!row?.selectable) {
          setApplyError(
            row?.state === 'unsuitable'
              ? 'This model cannot run Graft agent work.'
              : 'This model is unavailable.',
          )
          return
        }
        if (!isProviderActivated(providerId, loadState())) {
          setApplyError(
            `No saved key for ${provider.label}. Run /provider and paste an API key first.`,
          )
          return
        }
        applyModel(
          providerId,
          { id: row.id, label: row.label },
          provider.label,
          row.state === 'slow',
        )
      }}
    />
  )
}

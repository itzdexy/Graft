import * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Command, LocalJSXCommandContext } from '../../commands.js'
import { Box, Text, useAnimationFrame, useInput } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { GraftSearchList } from '../../components/graft/GraftSearchList.js'
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings.js'
import { countAllCatalogModels } from '../../../scripts/graft-provider-catalog.js'
import {
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  isProviderActivated,
  listProviderIds,
  loadState,
} from '../../../scripts/graft-providers.js'
import { activateProviderModel } from '../../services/graft/activateProviderModel.js'
import {
  runModelActivationAttempt,
  type ModelActivationLock,
} from './modelActivationFlow.js'
import { resolveProviderModelsForPicker } from '../../services/graft/catalogModels.js'
import {
  getCachedProviderModelDescriptorsFor,
  getCachedProviderModelIdsFor,
  prefetchConnectedProviderModels,
} from '../../services/graft/providerModels.js'
import { validateModelForProvider } from '../../services/graft/validateProviderModel.js'
import { providerNeedsOpenAiCompat } from '../../../scripts/graft-provider-upstream.js'
import { isLocalProvider } from '../../../scripts/graft-provider-local.js'
import { isNetworkConnected } from '../../utils/network.js'
import { getProviderModelUnavailableReason } from '../../services/graft/modelAvailability.js'
import {
  formatSearchSummary,
  searchModels,
  shouldOfferCustomModelId,
} from '../../services/graft/search/pickerSearch.js'
import {
  buildModelRows,
  countProviders,
  modelRowGroup,
  presentModelRow,
  type ProviderModelSource,
} from '../../services/graft/search/modelRows.js'

const ACCENT = 'suggestion'
const CUSTOM_KEY = '__custom__'
/** Joins provider and model in a list key. Cannot occur inside a model id. */
const KEY_SEPARATOR = '::'

const ACTIVATION_FRAMES = ['◜', '◝', '◞', '◟'] as const

/** Proof-of-life while a model probe is in flight (probes can take seconds). */
function CheckingRow({
  providerLabel,
  modelId,
}: {
  providerLabel: string
  modelId: string
}): React.ReactNode {
  const [ref, time] = useAnimationFrame(120)
  const frame = Math.floor(time / 120) % ACTIVATION_FRAMES.length
  return (
    <Box ref={ref} marginTop={1} flexDirection="row" gap={1}>
      <Text color={ACCENT}>{ACTIVATION_FRAMES[frame]}</Text>
      <Text color={ACCENT}>
        Checking {modelId} on {providerLabel}…
      </Text>
    </Box>
  )
}

/**
 * Flat header for the picker. Replaced a bordered card with a mascot sprite and
 * a stacked provider block: at any real terminal width that chrome pushed the
 * model list itself below the fold, which is the only thing being chosen here.
 */
function Frame({
  subtitle,
  children,
}: {
  subtitle: string
  children: React.ReactNode
}): React.ReactNode {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text wrap="truncate-end">
        <Text bold color={ACCENT}>
          Graft
        </Text>
        <Text color="subtle" dimColor>{`  ${subtitle}`}</Text>
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  )
}

/**
 * Every provider that can contribute models, with its live list resolved.
 *
 * Each provider gets its OWN cached live list. Previously only the active
 * provider had one, so every other provider silently fell back to the static
 * catalog and showed a fraction of what it serves.
 */
function collectModelSources(
  state: ReturnType<typeof loadState>,
  activeProviderId: string,
  includeDisconnected: boolean,
): ProviderModelSource[] {
  const isOnline = isNetworkConnected()
  const candidateIds = includeDisconnected
    ? listProviderIds()
    : [activeProviderId]

  const sources: ProviderModelSource[] = []
  for (const providerId of candidateIds) {
    const provider = getProvider(providerId, state)
    if (!provider) continue
    if (String(provider.category).startsWith('media_')) continue
    if (!isOnline && !isLocalProvider(provider)) continue

    const liveIds = getCachedProviderModelIdsFor(providerId)
    const models = resolveProviderModelsForPicker(provider, liveIds, {
      providerId,
      isActiveProvider: providerId === activeProviderId,
    })
    if (models.length === 0) continue

    const descriptors = getCachedProviderModelDescriptorsFor(providerId)

    sources.push({
      providerId,
      providerLabel: provider.label,
      models,
      connected: isProviderActivated(providerId, state),
      anyModel: provider.anyModel,
      verifiedIds: liveIds ? new Set(liveIds) : undefined,
      descriptors: descriptors ?? undefined,
      local: isLocalProvider(provider),
      activeModelId: getActiveModelId(providerId, state) || undefined,
      unavailableIds: new Set(
        models
          .filter(m => getProviderModelUnavailableReason(providerId, m.id))
          .map(m => m.id),
      ),
    })
  }
  return sources
}

/**
 * `/model` — one searchable list of every model on every connected provider.
 *
 * The previous flow was provider-first with no search at all: you picked a
 * provider, then scrolled its models. That made "which of my providers has
 * Opus?" unanswerable without walking each one by hand, and there was no way
 * to find a model by name. Now the query matches labels, bare ids, qualified
 * `provider/model` ids, and provider nicknames at once.
 */
function ModelsFlow({
  onDone,
  setAppState,
}: {
  onDone: LocalJSXCommandOnDone
  setAppState?: (
    f: (
      prev: import('../../state/AppStateStore.js').AppState,
    ) => import('../../state/AppStateStore.js').AppState,
  ) => void
}): React.ReactNode {
  const [query, setQuery] = useState('')
  const [verifiedRefresh, setVerifiedRefresh] = useState(0)
  const [includeDisconnected, setIncludeDisconnected] = useState(false)
  // Enter starts a network probe that can take seconds. Without these the
  // picker looked frozen — the whole "nothing happens on Enter" report.
  const [checking, setChecking] = useState<{
    providerLabel: string
    modelId: string
  } | null>(null)
  const [activationError, setActivationError] = useState<string | null>(null)
  // A model that only timed out is usable — the provider answered, it was just
  // slow. Remember which one so a second Enter can accept it rather than
  // leaving a working model permanently unselectable.
  const [slowCandidate, setSlowCandidate] = useState<{
    providerId: string
    modelId: string
  } | null>(null)
  const activationLock = useRef<ModelActivationLock>({ current: false }).current

  useExitOnCtrlCDWithKeybindings(() => onDone('', { display: 'skip' }))

  const state = loadState()
  const activeProviderId = getActiveProviderId(state)
  const activeDef = getProvider(activeProviderId, state)

  // Default to the selected provider; explicit catalog browsing may span providers.
  useEffect(() => {
    const targets = includeDisconnected
      ? listProviderIds().filter((id: string) => isProviderActivated(id, state))
      : [activeProviderId]
    if (targets.length === 0) return

    let cancelled = false
    prefetchConnectedProviderModels(targets)
    // Re-read the cache shortly after; the fetches populate it in the
    // background and the picker should fill in as they land.
    const timer = setInterval(() => {
      if (cancelled) return
      setVerifiedRefresh(n => n + 1)
    }, 900)
    const stop = setTimeout(() => clearInterval(timer), 12_000)
    return () => {
      cancelled = true
      clearInterval(timer)
      clearTimeout(stop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state read fresh
  }, [includeDisconnected, activeProviderId])

  const sources = useMemo(
    () => collectModelSources(state, activeProviderId, includeDisconnected),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state is read fresh each render
    [activeProviderId, includeDisconnected, verifiedRefresh],
  )

  const verifiedModelIds = useMemo(
    () => new Set(getCachedProviderModelIdsFor(activeProviderId) ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh after fetch
    [activeProviderId, verifiedRefresh],
  )

  const rows = useMemo(
    () => buildModelRows({ sources, activeProviderId, includeDisconnected }),
    [sources, activeProviderId, includeDisconnected],
  )
  const ranked = useMemo(() => searchModels(rows, query), [rows, query])

  const applyModel = useCallback(
    async (providerId: string, modelId: string) => {
      const def = getProvider(providerId)
      const providerLabel = def?.label || providerId
      const latest = loadState()
      if (!isProviderActivated(providerId, latest)) {
        setActivationError(
          `No API key for ${providerLabel}. Run /provider, pick ${providerLabel}, and paste your API key.`,
        )
        return
      }

      const currentProviderId = getActiveProviderId(latest)
      // Second Enter on a model we already know is merely slow: take it.
      const allowSlow =
        slowCandidate?.providerId === providerId &&
        slowCandidate?.modelId === modelId
      await runModelActivationAttempt({
        lock: activationLock,
        providerId,
        providerLabel,
        modelId,
        active: {
          providerLabel:
            getProvider(currentProviderId, latest)?.label || currentProviderId,
          modelId: getActiveModelId(currentProviderId, latest),
        },
        activate: candidate =>
          activateProviderModel({ ...candidate, allowSlow, setAppState }),
        onChecking: ({ providerLabel: label, modelId: id }) => {
          setActivationError(null)
          setChecking({ providerLabel: label, modelId: id })
        },
        // A rejected model leaves the picker open so Enter can retry or
        // pick another row, instead of dumping the user back into chat.
        onFailure: (message, result) => {
          setChecking(null)
          const retryable = result.readiness === 'slow'
          setSlowCandidate(retryable ? { providerId, modelId } : null)
          setActivationError(
            retryable
              ? `${message} Press Enter again to use it anyway.`
              : message,
          )
        },
        onSuccess: result => {
          setChecking(null)
          setSlowCandidate(null)
          const note = result.readiness === 'slow' ? ' (slow to respond)' : ''
          onDone(`Model · ${providerLabel} · ${result.modelId}${note}`, {
            display: 'system',
          })
        },
      })
    },
    [onDone, setAppState, activationLock, slowCandidate],
  )

  const applyCustomModel = useCallback(
    async (providerId: string, modelId: string) => {
      setActivationError(null)
      const validation = await validateModelForProvider(providerId, modelId, {
        forceFetch: true,
      })
      if (!validation.ok) {
        setActivationError(
          validation.suggestion
            ? `${validation.message} Try ${validation.suggestion}, or pick a listed model.`
            : validation.message,
        )
        return
      }
      await applyModel(providerId, validation.model)
    },
    [applyModel],
  )

  // Ctrl+A widens the list past connected providers, so the full catalog is
  // still reachable without making it the default wall of 300 unusable rows.
  useInput(
    (input, key) => {
      if (key.ctrl && input === 'a') {
        setIncludeDisconnected(current => !current)
      }
    },
    { isActive: checking === null },
  )

  // A gateway that takes arbitrary ids can serve a model that shipped after
  // this catalog did. If the query looks like an id nothing matched, offer it.
  const anyModelProvider = sources.find(source => source.anyModel && source.connected)
  const offerCustom =
    anyModelProvider !== undefined &&
    shouldOfferCustomModelId({
      query,
      anyModel: true,
      matches: ranked.map(r => r.item),
    })

  const items = ranked.map(({ item, indices }) => {
    const presentation = presentModelRow(item)
    return {
      // Not the qualified id: model ids legitimately contain slashes
      // ("anthropic/claude-haiku-4-5" on OpenRouter), so splitting a
      // provider/model key on "/" would hand activation a truncated id.
      key: `${item.providerId}${KEY_SEPARATOR}${item.modelId}`,
      label: item.label,
      detail: presentation.detail,
      badge: presentation.badge,
      badgeTone: presentation.badgeTone,
      group: modelRowGroup(item, query),
      matchIndices: indices,
    }
  })

  if (offerCustom && anyModelProvider) {
    items.push({
      key: CUSTOM_KEY,
      label: `Use "${query.trim()}" as a model id`,
      detail: `${anyModelProvider.providerLabel} · verified on Enter`,
      badge: 'custom',
      badgeTone: 'warning' as const,
      group: undefined,
      matchIndices: [],
    })
  }

  const activeModel = getActiveModelId(activeProviderId, state)
  const activeModelLabel =
    activeDef?.models.find((m: { id: string; label: string }) => m.id === activeModel)
      ?.label || activeModel
  const isOnline = isNetworkConnected()
  const catalogModelCount = countAllCatalogModels()

  return (
    <Frame
      subtitle={
        includeDisconnected
          ? `Models · full catalog (${catalogModelCount}+)`
          : 'Models · connected providers'
      }
    >
      <GraftSearchList
        title="Choose a model"
        items={items}
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by model, provider, or provider/model id"
        summary={formatSearchSummary({
          shown: ranked.length,
          total: rows.length,
          noun: 'model',
          query,
          providerCount: countProviders(rows),
        })}
        status={
          <Text color="subtle" dimColor wrap="truncate-end">
            {'Active '}
            <Text color="success">
              {activeDef?.label || activeProviderId || 'none'}
            </Text>
            {activeModelLabel ? (
              <Text color="text">{` · ${activeModelLabel}`}</Text>
            ) : null}
            {verifiedModelIds.size > 0
              ? `   ${verifiedModelIds.size} verified on your key`
              : ''}
          </Text>
        }
        notice={
          activationError
            ? { tone: 'error', text: activationError }
            : !isOnline
              ? {
                  tone: 'warning',
                  text: 'No network detected — only local providers (Ollama, LM Studio) are listed.',
                }
              : null
        }
        emptyMessage={
          rows.length === 0
            ? 'No connected providers yet. Run /provider to add an API key.'
            : `No model matches "${query.trim()}". Ctrl+A searches the full catalog.`
        }
        footerHint={
          includeDisconnected
            ? 'ctrl+a connected only'
            : 'ctrl+a all providers'
        }
        initialKey={
          activeModel
            ? `${activeProviderId}${KEY_SEPARATOR}${activeModel}`
            : undefined
        }
        visibleCount={12}
        isDisabled={checking !== null}
        onCancel={() => onDone('', { display: 'skip' })}
        onSelect={key => {
          if (key === CUSTOM_KEY) {
            if (anyModelProvider) {
              void applyCustomModel(anyModelProvider.providerId, query.trim())
            }
            return
          }
          const separator = key.indexOf(KEY_SEPARATOR)
          void applyModel(
            key.slice(0, separator),
            key.slice(separator + KEY_SEPARATOR.length),
          )
        }}
      />
      {checking ? (
        <CheckingRow
          providerLabel={checking.providerLabel}
          modelId={checking.modelId}
        />
      ) : null}
    </Frame>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  return <ModelsFlow onDone={onDone} setAppState={context.setAppState} />
}

const modelCommand = {
  type: 'local-jsx',
  name: 'model',
  aliases: ['models'],
  description: 'Graft — search and switch models across connected providers',
  // The implementation is already loaded; self-imports break Bun's split bundle.
  load: async () => ({ call }),
} satisfies Command

export default modelCommand

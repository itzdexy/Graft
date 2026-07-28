import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Command, LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import {
  type OptionWithDescription,
  Select,
} from '../../components/CustomSelect/select.js'
import TextInput from '../../components/TextInput.js'
import { TovyrBuddy } from '../../components/LogoV2/TovyrBuddy.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings.js'
import {
  PROVIDER_CATEGORIES,
  countAllCatalogModels,
  listProvidersByCategory,
} from '../../scripts/tovyr-provider-catalog.js'
import {
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  isProviderActivated,
  listActivatedProviderIds,
  loadState,
  setActiveProvider,
  setActiveModel,
} from '../../scripts/tovyr-providers.js'
import {
  applyActiveProviderSession,
  formatProviderAppliedMessage,
} from '../../services/tovyr/applyActiveProvider.js'
import { resolveProviderModelsForPicker } from '../../services/tovyr/catalogModels.js'
import {
  fetchActiveProviderModelIds,
  getCachedProviderModelIds,
} from '../../services/tovyr/providerModels.js'
import { validateModelForProvider } from '../../services/tovyr/validateProviderModel.js'
import { providerNeedsOpenAiCompat } from '../../scripts/tovyr-provider-upstream.js'

const ACCENT = 'suggestion'
const DONE_VALUE = '__done__'

function parseCustomValue(value: string): string | null {
  if (!value.startsWith('custom:')) return null
  return value.slice('custom:'.length) || null
}

function categoryLabel(cat: string): string {
  return (PROVIDER_CATEGORIES as Record<string, string>)[cat] || cat || 'Provider'
}

const TIER_LABEL: Record<string, string> = {
  opus: 'Best',
  sonnet: 'Balanced',
  haiku: 'Fast',
}

function parsePickValue(value: string): { providerId: string; modelId: string } | null {
  if (!value.startsWith('pick:')) return null
  const rest = value.slice('pick:'.length)
  const sep = rest.indexOf(':')
  if (sep === -1) return null
  return {
    providerId: rest.slice(0, sep),
    modelId: rest.slice(sep + 1),
  }
}

function buildCatalogOptions(
  state: ReturnType<typeof loadState>,
  verifiedModelIds: Set<string>,
  onlyProviderId?: string,
): OptionWithDescription<string>[] {
  const options: OptionWithDescription<string>[] = []
  const groups = listProvidersByCategory()
  const categoryOrder = Object.keys(PROVIDER_CATEGORIES)
  const activeProviderId = getActiveProviderId(state)
  const activeModel = getActiveModelId(activeProviderId, state)
  let lastCategory: string | null = null

  for (const cat of categoryOrder) {
    const providers = groups[cat]
    if (!providers?.length) continue

    const visibleProviders = onlyProviderId
      ? providers.filter(p => p.id === onlyProviderId)
      : providers
    if (!visibleProviders.length) continue

    if (lastCategory !== null && !onlyProviderId) {
      options.push({
        value: `sep:${cat}`,
        label: ' ',
        disabled: true,
      })
    }

    if (!onlyProviderId) {
      options.push({
        value: `cat:${cat}`,
        label: `── ${categoryLabel(cat).toUpperCase()} ──`,
        disabled: true,
      })
    }
    lastCategory = cat

    for (const p of visibleProviders) {
      const activated = isProviderActivated(p.id, state)
      const isActiveProvider = p.id === activeProviderId
      const sorted = resolveProviderModelsForPicker(
        p,
        verifiedModelIds.size > 0 ? verifiedModelIds : null,
        { providerId: p.id, isActiveProvider },
      )
      const modelCount = sorted.length

      options.push({
        value: `header:${p.id}`,
        label: (
          <Text bold color={isActiveProvider ? 'success' : ACCENT}>
            {isActiveProvider ? '▸ ' : '  '}
            {p.label}
            {isActiveProvider ? '  (active)' : ''}
          </Text>
        ),
        description: [
          categoryLabel(p.category),
          activated ? 'key saved' : 'connect via /provider',
          p.anyModel ? 'any model id' : null,
          modelCount ? `${modelCount} models` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        disabled: true,
      })

      for (const m of sorted) {
        const isActive = isActiveProvider && m.id === activeModel
        const onActiveProvider = p.id === activeProviderId
        const verified =
          activated && onActiveProvider && verifiedModelIds.has(m.id)
        options.push({
          value: `pick:${p.id}:${m.id}`,
          label: isActive
            ? `● ${m.label}`
            : verified
              ? `  ✓ ${m.label}`
              : `  ${m.label}`,
          description: [
            m.id,
            verified
              ? 'verified for your key'
              : activated && onActiveProvider && verifiedModelIds.size > 0
                ? 'not verified — may 404'
                : null,
            TIER_LABEL[m.tier] || m.tier,
            m.context,
            activated ? null : 'needs API key',
          ]
            .filter(Boolean)
            .join(' · '),
          disabled: !activated,
        })
      }

      if (p.anyModel) {
        options.push({
          value: `custom:${p.id}`,
          label: activated ? '  Enter any model id…' : '  Enter model id (connect key first)…',
          description: activated
            ? 'Any model id this endpoint supports'
            : 'Run /provider and save an API key first',
          disabled: !activated,
        })
      } else if (sorted.length === 0) {
        options.push({
          value: `empty:${p.id}`,
          label: '  No catalog models',
          description: 'Use /provider model <id>',
          disabled: true,
        })
      }
    }
  }

  return options
}

function Frame({
  subtitle,
  children,
}: {
  subtitle: string
  children: React.ReactNode
}): React.ReactNode {
  const state = loadState()
  const activeProviderId = getActiveProviderId(state)
  const activeDef = getProvider(activeProviderId, state)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={ACCENT} paddingX={2} paddingY={1}>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <TovyrBuddy pose="default" inline />
        <Box flexDirection="column" marginLeft={1} flexGrow={1}>
          <Text bold color={ACCENT}>
            Tovyr
          </Text>
          <Text dimColor>{subtitle}</Text>
          {activeDef ? (
            <Box marginTop={1}>
              <Text>
                Provider:{' '}
                <Text bold color="success">
                  {activeDef.label}
                </Text>
              </Text>
            </Box>
          ) : null}
        </Box>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  )
}

function ModelsFlow({
  onDone,
  setAppState,
}: {
  onDone: LocalJSXCommandOnDone
  setAppState?: (f: (prev: import('../../state/AppStateStore.js').AppState) => import('../../state/AppStateStore.js').AppState) => void
}): React.ReactNode {
  const { columns } = useTerminalSize()
  const [step, setStep] = useState<'catalog' | 'custom'>('catalog')
  const [customForProviderId, setCustomForProviderId] = useState<string | null>(null)
  const [customId, setCustomId] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [verifiedRefresh, setVerifiedRefresh] = useState(0)
  const [showAllProviders, setShowAllProviders] = useState(false)

  useExitOnCtrlCDWithKeybindings(() => onDone('', { display: 'skip' }))

  const state = loadState()
  const activeProviderId = getActiveProviderId(state)
  const activeDef = getProvider(activeProviderId, state)

  useEffect(() => {
    if (!activeDef || !providerNeedsOpenAiCompat(activeDef)) return
    let cancelled = false
    void fetchActiveProviderModelIds({ force: true }).then(ids => {
      if (!cancelled && ids?.length) setVerifiedRefresh(n => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [activeDef?.id])

  const verifiedModelIds = useMemo(
    () => new Set(getCachedProviderModelIds() ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh after fetch
    [activeProviderId, verifiedRefresh],
  )
  const activeModel = getActiveModelId(activeProviderId, state)
  const activatedCount = listActivatedProviderIds(state).length
  const catalogModelCount = countAllCatalogModels()
  const verifiedCount = verifiedModelIds.size

  const catalogOptions = useMemo(() => {
    const options = buildCatalogOptions(
      state,
      verifiedModelIds,
      showAllProviders ? undefined : activeProviderId || undefined,
    )
    options.unshift({
      value: showAllProviders ? 'view:active' : 'view:all',
      label: showAllProviders
        ? '▸ Focus active provider'
        : '▸ Browse all providers',
      description: showAllProviders
        ? `Show verified models for ${activeDef?.label || 'active provider'} only`
        : `Full catalog (${catalogModelCount}+ models across all providers)`,
    })
    options.push({
      value: DONE_VALUE,
      label: 'Done',
      description: 'Return to chat without changing model',
    })
    return options
  }, [state, verifiedModelIds, showAllProviders, activeProviderId, activeDef?.label, catalogModelCount])

  const defaultFocus =
    activeModel && activeProviderId
      ? `pick:${activeProviderId}:${activeModel}`
      : undefined

  const applyModel = useCallback(
    async (providerId: string, modelId: string) => {
      const def = getProvider(providerId)
      const latest = loadState()
      if (!isProviderActivated(providerId, latest)) {
        onDone(
          `No API key for ${def?.label || providerId}. Run /provider, pick ${def?.label || providerId}, and paste your API key.`,
        )
        return
      }

      const validation = await validateModelForProvider(providerId, modelId, {
        forceFetch: true,
      })
      if (!validation.ok) {
        onDone(
          validation.suggestion
            ? `${validation.message}\n\nSuggested: ${validation.suggestion}`
            : validation.message,
        )
        return
      }

      setActiveProvider(providerId)
      setActiveModel(validation.model, providerId)

      let message = `Active → ${def?.label || providerId} · ${validation.model}`
      if (validation.corrected && validation.notice) {
        message += `\n${validation.notice}`
      }
      try {
        const active = await applyActiveProviderSession({ setAppState })
        message += `\n${formatProviderAppliedMessage(active)}`
      } catch (err) {
        message += `\n${err instanceof Error ? err.message : String(err)}`
      }
      onDone(message)
    },
    [onDone, setAppState],
  )

  const customProviderId = customForProviderId || activeProviderId
  const customDef = getProvider(customProviderId, state)

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customId.trim()
    if (!trimmed) {
      setError('Enter a model id.')
      return
    }
    void (async () => {
      const validation = await validateModelForProvider(customProviderId, trimmed, {
        forceFetch: true,
      })
      if (!validation.ok) {
        setError(
          validation.suggestion
            ? `${validation.message} Try ${validation.suggestion} or pick from the ✓ list.`
            : validation.message,
        )
        return
      }
      void applyModel(customProviderId, validation.model)
    })()
  }, [customId, applyModel, customProviderId])

  if (step === 'custom') {
    return (
      <Frame subtitle={`Custom model · ${customDef?.label || customProviderId}`}>
        <Text dimColor>Gateways accept any model id their platform supports.</Text>
        <Box marginTop={1} borderStyle="round" borderColor={error ? 'error' : 'secondaryText'} paddingX={1}>
          <TextInput
            value={customId}
            onChange={setCustomId}
            onSubmit={handleCustomSubmit}
            onPaste={setCustomId}
            focus
            placeholder="provider/model-id"
            columns={columns}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            showCursor
          />
        </Box>
        {error ? <Text color="error">{error}</Text> : null}
        <Box marginTop={1}>
          <Text dimColor>Enter to apply · Ctrl+C to cancel</Text>
        </Box>
      </Frame>
    )
  }

  const activeModelLabel =
    activeDef?.models.find(m => m.id === activeModel)?.label || activeModel

  return (
    <Frame
      subtitle={
        showAllProviders
          ? `Models · all providers (${catalogModelCount}+) · best → fast`
          : `Models · ${activeDef?.label || 'provider'} · verified picks`
      }
    >
      <Text dimColor>
        Active:{' '}
        <Text color="success">{activeDef?.label || activeProviderId || 'none'}</Text>
        {activeModelLabel ? (
          <>
            {' '}
            · <Text bold>{activeModelLabel}</Text>
          </>
        ) : null}
      </Text>
      {!showAllProviders ? (
        <Text dimColor>
          Showing models for your connected provider · Enter to switch · pick ✓ rows for reliability
        </Text>
      ) : (
        <Text dimColor>
          All built-in providers · {activatedCount} connected · dimmed = run /provider first
        </Text>
      )}
      {verifiedCount > 0 && activeDef && providerNeedsOpenAiCompat(activeDef) ? (
        <Text dimColor>
          Showing {verifiedCount} models verified for {activeDef.label} · ✓ = on your key
        </Text>
      ) : verifiedCount > 0 ? (
        <Text dimColor>
          ✓ = verified for your {activeDef?.label || 'active'} key ({verifiedCount} models)
        </Text>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>↑/↓ browse · Enter select · top row toggles all providers</Text>
      </Box>
      <Box marginTop={1}>
        <Select
          options={catalogOptions}
          defaultFocusValue={defaultFocus}
          visibleOptionCount={14}
          layout="compact-vertical"
          onChange={(value: string) => {
            if (value === 'view:all') {
              setShowAllProviders(true)
              return
            }
            if (value === 'view:active') {
              setShowAllProviders(false)
              return
            }
            if (value === DONE_VALUE) {
              onDone('', { display: 'skip' })
              return
            }
            const customProvider = parseCustomValue(value)
            if (customProvider) {
              setCustomForProviderId(customProvider)
              setCustomId(getActiveModelId(customProvider, state) || '')
              setError(null)
              setStep('custom')
              return
            }
            const pick = parsePickValue(value)
            if (pick) void applyModel(pick.providerId, pick.modelId)
          }}
          onCancel={() => onDone('', { display: 'skip' })}
        />
      </Box>
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
  description: 'Tovyr — browse all catalog models by provider and switch',
  load: () => import('./models.js'),
} satisfies Command

export default modelCommand

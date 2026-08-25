import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { getCachedProviderModelIds } from '../../services/tovyr/providerModels.js'
import { getActiveProviderId, getProvider } from '../../scripts/tovyr-providers.js'
import { renderModelName } from '../../utils/model/model.js'
import { truncateToWidth } from '../../utils/format.js'
import { Centered } from '../design-system/Centered.js'
import { SPACING } from '../design-system/spacing.js'
import { useRegisterOverlay } from '../../context/overlayContext.js'

type Props = {
  onSelect: (modelId: string) => Promise<string | null>
  onClose: () => void
}

const MAX_VISIBLE = 14

type ModelGroup = {
  provider: string
  models: string[]
}

function getProviderFromModelId(modelId: string): string {
  const slashIndex = modelId.indexOf('/')
  return slashIndex > 0 ? modelId.slice(0, slashIndex) : 'default'
}

function groupModelsByProvider(modelIds: string[]): ModelGroup[] {
  const byProvider = new Map<string, string[]>()
  for (const id of modelIds) {
    const provider = getProviderFromModelId(id)
    if (!byProvider.has(provider)) byProvider.set(provider, [])
    byProvider.get(provider)!.push(id)
  }
  return Array.from(byProvider.entries())
    .map(([provider, models]) => ({ provider, models }))
    .sort((a, b) => a.provider.localeCompare(b.provider))
}

type FlatItem =
  | { type: 'header'; provider: string }
  | { type: 'model'; modelId: string }

function buildFlatItems(groups: ModelGroup[]): FlatItem[] {
  const items: FlatItem[] = []
  for (const g of groups) {
    items.push({ type: 'header', provider: g.provider })
    for (const m of g.models) {
      items.push({ type: 'model', modelId: m })
    }
  }
  return items
}

/** Searchable model selector modal — reads from provider registry + live API cache. */
export const TovyrModelSelector = memo(function TovyrModelSelector({
  onSelect,
  onClose,
}: Props): ReactNode {
  useRegisterOverlay('tovyr-model-selector')
  const { columns } = useTerminalSize()
  const currentModel = useMainLoopModel()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(1)
  const [checkingModel, setCheckingModel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const providerId = getActiveProviderId()
  const activeProvider = getProvider(providerId)
  const providerLabel = activeProvider?.label ?? providerId

  const cachedModels = useMemo(() => {
    return getCachedProviderModelIds() ?? []
  }, [])

  const models = useMemo(() => {
    if (cachedModels.length > 0) return cachedModels
    return [currentModel]
  }, [cachedModels, currentModel])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return models
    return models.filter((m: string) => m.toLowerCase().includes(q))
  }, [models, query])

  const grouped = useMemo(() => {
    return groupModelsByProvider(filtered.slice(0, MAX_VISIBLE))
  }, [filtered])

  const flatItems = useMemo(() => buildFlatItems(grouped), [grouped])

  useEffect(() => {
    setSelectedIndex(1)
  }, [query])

  const selectModel = useCallback(async (modelId: string) => {
    if (checkingModel) return
    setError(null)
    setCheckingModel(modelId)
    try {
      const selectionError = await onSelect(modelId)
      if (selectionError) {
        setError(selectionError)
        return
      }
      onClose()
    } catch {
      setError('Could not verify this model.')
    } finally {
      setCheckingModel(null)
    }
  }, [checkingModel, onClose, onSelect])

  useInput(useCallback((_input: string, key: any) => {
    if (checkingModel) return
    if (key.escape || (key.ctrl && key.name === 'c')) {
      onClose()
      return
    }
    if (key.return) {
      const selected = flatItems[selectedIndex]
      if (selected && selected.type === 'model') {
        void selectModel(selected.modelId)
      }
      return
    }
    if (key.upArrow) {
      setSelectedIndex((i: number) => {
        let next = Math.max(0, i - 1)
        while (next > 0 && flatItems[next]?.type === 'header') {
          next = Math.max(0, next - 1)
        }
        return next
      })
      return
    }
    if (key.downArrow) {
      setSelectedIndex((i: number) => {
        let next = Math.min(flatItems.length - 1, i + 1)
        while (next < flatItems.length - 1 && flatItems[next]?.type === 'header') {
          next = Math.min(flatItems.length - 1, next + 1)
        }
        return next
      })
      return
    }
    if (key.name && key.name.length === 1 && !key.ctrl && !key.meta) {
      setQuery((prev: string) => prev + key.name)
      return
    }
    if (key.name === 'backspace') {
      setQuery((prev: string) => prev.slice(0, -1))
    }
  }, [checkingModel, flatItems, selectedIndex, selectModel, onClose]))

  const width = Math.min(columns - SPACING.md, 70)

  return (
    <Centered maxWidth={74} minWidth={40} paddingX={2}>
      <Box flexDirection="column" width={width} paddingX={1} paddingY={1} borderStyle="round" borderColor="tovyrPrimary">
        <Box flexDirection="row" marginBottom={0}>
          <Text color="tovyrPrimary" bold>{'> '}</Text>
          <Text color="text">{query}</Text>
          <Text color="tovyrPrimary">{'_'}</Text>
        </Box>
        <Box marginTop={0} marginBottom={1}>
          <Text color="tovyrSecondary" dimColor>
            {providerLabel} · {filtered.length} model{filtered.length !== 1 ? 's' : ''}
          </Text>
        </Box>
        <Box flexDirection="column">
          {filtered.length === 0 ? (
            <Text color="subtle" dimColor>No models found</Text>
          ) : (
            flatItems.map((item: FlatItem, i: number) => {
              const isSelected = i === selectedIndex
              if (item.type === 'header') {
                return (
                  <Box key={item.provider} marginTop={1}>
                    <Text color="subtle" dimColor bold>{item.provider}</Text>
                  </Box>
                )
              }
              const modelId = item.modelId
              const isCurrent = modelId === currentModel
              const label = renderModelName(modelId as any)
              const display = truncateToWidth(label, width - 6)
              return (
                <Box key={modelId} flexDirection="row">
                  <Text color={isSelected ? 'tovyrPrimary' : 'subtle'} bold={isSelected}>
                    {isCurrent ? '● ' : isSelected ? '› ' : '  '}
                  </Text>
                  <Text color={isSelected ? 'tovyrPrimary' : 'text'} bold={isSelected}>
                    {display}
                  </Text>
                </Box>
              )
            })
          )}
        </Box>
        <Box marginTop={1}>
          {checkingModel ? <Text color="tovyrPrimary">Checking {checkingModel}...</Text> : error ? (
            <Text color="error">{error}</Text>
          ) : (
            <Text color="subtle" dimColor>
              <Text color="tovyrPrimary" bold>↑↓</Text> navigate{' · '}
              <Text color="tovyrPrimary" bold>Enter</Text> select{' · '}
              <Text color="tovyrPrimary" bold>Esc</Text> close
            </Text>
          )}
        </Box>
      </Box>
    </Centered>
  )
})

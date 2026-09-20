import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Box, Text, useInput } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { getCachedProviderModelIds } from '../../services/graft/providerModels.js'
import {
  humanizeOpenAiModelId,
  resolveProviderModelsForPicker,
} from '../../services/graft/catalogModels.js'
import {
  getActiveProviderId,
  getProvider,
} from '../../../scripts/graft-providers.js'
import { truncateToWidth } from '../../utils/format.js'
import { Centered } from '../design-system/Centered.js'
import { SPACING } from '../design-system/spacing.js'
import { getProviderModelUnavailableReason } from '../../services/graft/modelAvailability.js'
import { getModelReadiness } from '../../services/graft/modelReadiness.js'
import { useRegisterOverlay } from '../../context/overlayContext.js'
import { useAppState, useSetAppState } from '../../state/AppState.js'
import {
  cycleEffortLevel,
  getDisplayedEffortLevel,
  listEffortLevelsForModel,
  modelSupportsEffort,
  toPersistableEffort,
} from '../../utils/effort.js'
import { updateSettingsForSource } from '../../utils/settings/settings.js'

type Props = {
  onSelect: (modelId: string) => Promise<string | null>
  onClose: () => void
}

const MAX_VISIBLE = 10
/** Fast default when present on NIM — avoids GLM thinking tax by recommendation. */
const RECOMMENDED_NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct'

function isNvidiaProvider(providerId: string): boolean {
  return providerId === 'nvidia_nim'
}

function prioritizeModels(
  models: string[],
  currentModel: string,
  providerId: string,
): string[] {
  const unique = [...new Set(models)]
  const recommended =
    isNvidiaProvider(providerId) && unique.includes(RECOMMENDED_NVIDIA_MODEL)
      ? RECOMMENDED_NVIDIA_MODEL
      : undefined
  return unique.sort((left, right) => {
    const rank = (model: string): number => {
      if (model === currentModel) return 0
      if (model === recommended) return 1
      return 2
    }
    return rank(left) - rank(right) || left.localeCompare(right)
  })
}

/** Compact model picker. A candidate is verified before it becomes active. */
export const GraftModelSelector = memo(function GraftModelSelector({
  onSelect,
  onClose,
}: Props): ReactNode {
  useRegisterOverlay('graft-model-selector')
  const { columns } = useTerminalSize()
  const currentModel = useMainLoopModel()
  const effortValue = useAppState(s => s.effortValue)
  const setAppState = useSetAppState()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [checkingModel, setCheckingModel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // State updates land on the next render. This ref closes the small Enter / click
  // race in the current event turn, so activation can only begin once.
  const selectionInFlightRef = useRef(false)

  const providerId = getActiveProviderId()
  const activeProvider = getProvider(providerId)
  const providerLabel = activeProvider?.label ?? providerId

  const cachedModels = useMemo(() => {
    const verified = getCachedProviderModelIds()
    if (!activeProvider) {
      return verified ?? (currentModel ? [currentModel] : [])
    }
    const picker = resolveProviderModelsForPicker(
      activeProvider,
      verified && verified.length > 0 ? new Set(verified) : null,
      { providerId, isActiveProvider: true },
    )
    if (picker.length > 0) return picker.map(m => m.id)
    return verified ?? (currentModel ? [currentModel] : [])
  }, [activeProvider, currentModel, providerId])
  const models = useMemo(
    () =>
      prioritizeModels(
        cachedModels.length > 0 ? cachedModels : [currentModel],
        currentModel,
        providerId,
      ),
    [cachedModels, currentModel, providerId],
  )
  const selectableModels = useMemo(
    () =>
      models.filter(
        model => !getProviderModelUnavailableReason(providerId, model),
      ),
    [models, providerId],
  )
  const modelLabels = useMemo(
    () =>
      new Map(
        selectableModels.map(modelId => [
          modelId,
          activeProvider?.models?.find(model => model.id === modelId)?.label ??
            humanizeOpenAiModelId(modelId),
        ]),
      ),
    [activeProvider, selectableModels],
  )
  const filtered = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim()
    if (!normalizedQuery) return selectableModels
    return selectableModels.filter(model => {
      const label = modelLabels.get(model) ?? model
      return `${label}\0${model}`.toLowerCase().includes(normalizedQuery)
    })
  }, [modelLabels, query, selectableModels])

  useEffect(() => {
    const currentIndex = filtered.indexOf(currentModel)
    setSelectedIndex(currentIndex >= 0 ? currentIndex : 0)
  }, [query, currentModel, filtered])

  const visibleStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(MAX_VISIBLE / 2),
      Math.max(0, filtered.length - MAX_VISIBLE),
    ),
  )
  const visibleModels = filtered.slice(visibleStart, visibleStart + MAX_VISIBLE)

  const supportsEffort = modelSupportsEffort(currentModel)
  const displayedEffort = getDisplayedEffortLevel(currentModel, effortValue)
  const effortLevels = listEffortLevelsForModel(currentModel)

  const cycleEffort = useCallback(
    (direction: 'left' | 'right') => {
      if (!modelSupportsEffort(currentModel)) return
      const next = cycleEffortLevel(displayedEffort, direction, currentModel)
      const persistable = toPersistableEffort(next)
      if (persistable !== undefined) {
        updateSettingsForSource('userSettings', { effortLevel: persistable })
      }
      setAppState(prev => ({ ...prev, effortValue: next }))
    },
    [currentModel, displayedEffort, setAppState],
  )

  const selectModel = useCallback(
    async (modelId: string) => {
      if (checkingModel || selectionInFlightRef.current) return
      if (modelId === currentModel) {
        onClose()
        return
      }
      selectionInFlightRef.current = true
      setError(null)
      setCheckingModel(modelId)
      try {
        const selectionError = await onSelect(modelId)
        if (selectionError) {
          setError(selectionError)
        } else {
          onClose()
        }
      } catch {
        setError('Could not verify this model.')
      } finally {
        selectionInFlightRef.current = false
        setCheckingModel(null)
      }
    },
    [checkingModel, currentModel, onClose, onSelect],
  )

  useInput(
    useCallback(
      (_input: string, key: any) => {
        if (checkingModel) return
        if (key.escape || (key.ctrl && key.name === 'c')) {
          onClose()
          return
        }
        if (key.return) {
          const selected = filtered[selectedIndex]
          if (selected) void selectModel(selected)
          return
        }
        if (key.leftArrow) {
          cycleEffort('left')
          return
        }
        if (key.rightArrow) {
          cycleEffort('right')
          return
        }
        if (key.upArrow) {
          setSelectedIndex(index => Math.max(0, index - 1))
          return
        }
        if (key.downArrow) {
          setSelectedIndex(index =>
            Math.min(Math.max(0, filtered.length - 1), index + 1),
          )
          return
        }
        if (key.name === 'backspace') {
          setQuery(previous => previous.slice(0, -1))
          setError(null)
          return
        }
        if (key.name?.length === 1 && !key.ctrl && !key.meta) {
          setQuery(previous => previous + key.name)
          setError(null)
        }
      },
      [
        checkingModel,
        cycleEffort,
        filtered,
        onClose,
        selectModel,
        selectedIndex,
      ],
    ),
  )

  const width = Math.max(20, Math.min(columns - SPACING.md, 72))
  const modelWidth = Math.max(20, width - 18)

  return (
    <Centered maxWidth={76} minWidth={20} paddingX={2}>
      <Box
        flexDirection="column"
        width={width}
        paddingX={1}
        paddingY={1}
        gap={1}
        borderStyle="single"
        borderColor="subtle"
      >
        <Box justifyContent="space-between">
          <Text color="graftPrimary" bold>MODEL</Text>
          <Text color="subtle">
            {providerLabel} / {selectableModels.length}
          </Text>
        </Box>
        {supportsEffort ? (
          <Box>
            {effortLevels.map((level, index) => {
              const selected = level === displayedEffort
              return (
                <Text
                  key={level}
                  color={selected ? 'graftPrimary' : 'subtle'}
                  bold={selected}
                  dimColor={!selected}
                >
                  {index > 0 ? '  ' : ''}
                  {level}
                </Text>
              )
            })}
          </Box>
        ) : null}
        <Box>
          <Text color="subtle">Search: </Text>
          <Text color="text">{query}</Text>
          <Text color="graftPrimary">_</Text>
        </Box>

        <Box flexDirection="column">
          {filtered.length === 0 ? (
            <Text color="subtle">No matching models</Text>
          ) : (
            visibleModels.map((modelId, index) => {
              const isSelected = visibleStart + index === selectedIndex
              const isCurrent = modelId === currentModel
              const isRecommended =
                isNvidiaProvider(providerId) &&
                modelId === RECOMMENDED_NVIDIA_MODEL
              const readiness = getModelReadiness(providerId, modelId)?.state
              const status = isCurrent
                ? `current${readiness ? ` · ${readiness.replaceAll('_', ' ')}` : ''}`
                : readiness
                  ? readiness.replaceAll('_', ' ')
                  : isRecommended
                    ? 'recommended'
                    : 'listed'
              const label = modelLabels.get(modelId) ?? modelId
              return (
                <Box
                  key={modelId}
                  justifyContent="space-between"
                  onClick={() => void selectModel(modelId)}
                >
                  <Text
                    color={isSelected ? 'graftPrimary' : 'text'}
                    bold={isSelected}
                  >
                    {isSelected ? '> ' : '  '}
                    {truncateToWidth(label, modelWidth)}
                  </Text>
                  <Text color={isCurrent ? 'success' : 'subtle'} dimColor={!isCurrent}>
                    {status}
                  </Text>
                </Box>
              )
            })
          )}
        </Box>

        <Box>
          {checkingModel ? (
            <Text color="graftPrimary">
              Checking {truncateToWidth(checkingModel, width - 12)}...
            </Text>
          ) : error ? (
            <Text color="error">
              {truncateToWidth(error, width - 4)}
            </Text>
          ) : (
            <Text color="subtle">
              {supportsEffort
                ? 'Up/Down move  ←→ effort  Enter use  Esc close'
                : 'Up/Down move  Enter use  Esc close'}
            </Text>
          )}
        </Box>
      </Box>
    </Centered>
  )
})

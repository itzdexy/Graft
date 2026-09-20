import { formatProviderModelDisplayName } from '../../../scripts/graft-model-display.js'
import type { CatalogModel } from './catalogModels.js'
import type {
  ModelReadinessRecord,
  ModelReadinessState,
} from './modelReadiness.js'
import { isAgentSuitableOpenAiModel } from './openAiModelSuitability.js'

export type ModelPickerRow = CatalogModel & {
  state: ModelReadinessState
  selectable: boolean
  needsConfirmation: boolean
  description: string
}

type ReadinessProjection = Pick<
  ModelReadinessRecord,
  'state' | 'supportsTools' | 'supportsStreaming' | 'detail'
>

export function buildModelPickerRows(input: {
  providerId: string
  models: CatalogModel[]
  listedIds?: Set<string>
  readiness: Map<string, ReadinessProjection>
}): ModelPickerRow[] {
  return input.models.map(model => {
    const evidence = input.readiness.get(model.id)
    const suitable = isAgentSuitableOpenAiModel(model.id)
    const state: ModelReadinessState = !suitable
      ? 'unsuitable'
      : evidence?.state ??
        (input.listedIds?.has(model.id) ? 'listed' : 'unknown')
    const label = formatProviderModelDisplayName({
      providerId: input.providerId,
      modelId: model.id,
      label: model.label,
    })
    const evidenceLabel =
      state === 'listed'
        ? 'listed · unverified'
        : state === 'chat_only'
          ? 'chat only'
          : state.replaceAll('_', ' ')
    const toolLabel = evidence?.supportsTools === true ? ' · tools verified' : ''

    return {
      ...model,
      label,
      state,
      selectable: state !== 'unavailable' && state !== 'unsuitable',
      needsConfirmation: state === 'slow',
      description: `${model.tier} · ${evidenceLabel}${toolLabel}`,
    }
  })
}

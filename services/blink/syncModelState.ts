import { setMainLoopModelOverride } from '../../bootstrap/state.js'
import type { AppState } from '../../state/AppStateStore.js'
import { updateSettingsForSource } from '../../utils/settings/settings.js'

/** Keep REPL / API model in sync with ~/.blink/providers.json after /model or /provider. */
export function syncBlinkModelToSession(modelId: string): void {
  if (!modelId) return
  setMainLoopModelOverride(modelId)
  updateSettingsForSource('userSettings', { model: modelId })
}

export function patchAppStateForBlinkModel(
  prev: AppState,
  modelId: string,
): AppState {
  return {
    ...prev,
    mainLoopModel: modelId,
    mainLoopModelForSession: null,
  }
}

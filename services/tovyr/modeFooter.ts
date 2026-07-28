import type { PermissionMode } from '../../types/permissions.js'
import { getModeColor } from '../../utils/permissions/PermissionMode.js'
import type { PromptInputMode } from '../../types/textInputTypes.js'

export type TovyrFooterModeChip = {
  label: string
  color: ReturnType<typeof getModeColor> | 'bashBorder' | 'suggestion'
  isActive: boolean
}

function activeModeLabel(
  permissionMode: PermissionMode | undefined,
  inputMode: PromptInputMode,
): string | null {
  if (inputMode === 'bash') return 'bash'
  if (inputMode !== 'prompt') return null
  switch (permissionMode) {
    case 'plan':
      return 'plan'
    case 'acceptEdits':
      return 'code'
    case 'bypassPermissions':
      return 'bypass'
    case 'dontAsk':
      return 'dontask'
    case 'auto':
      return 'auto'
    case 'default':
    case undefined:
      return 'ask'
    default:
      return null
  }
}

function chip(
  label: string,
  color: TovyrFooterModeChip['color'],
  activeLabel: string | null,
): TovyrFooterModeChip {
  return { label, color, isActive: label === activeLabel }
}

/** Chips shown in the bottom-right Tovyr mode badge (plan, code, bypass, superthink, crush, …). */
export function resolveTovyrFooterModeChips(
  permissionMode: PermissionMode | undefined,
  superthinkEnabled: boolean,
  inputMode: PromptInputMode,
  crushEnabled = false,
): TovyrFooterModeChip[] {
  const chips: TovyrFooterModeChip[] = []
  const active = activeModeLabel(permissionMode, inputMode)

  if (inputMode === 'bash') {
    chips.push(chip('bash', 'bashBorder', active))
  }

  if (superthinkEnabled) {
    chips.push(chip('superthink·on', 'suggestion', active))
  }

  if (crushEnabled) {
    chips.push(chip('crush', 'suggestion', active))
  }

  if (inputMode !== 'prompt') {
    return chips
  }

  switch (permissionMode) {
    case 'plan':
      chips.push(chip('plan', getModeColor('plan'), active))
      break
    case 'acceptEdits':
      chips.push(chip('code', getModeColor('acceptEdits'), active))
      break
    case 'bypassPermissions':
      chips.push(chip('bypass', getModeColor('bypassPermissions'), active))
      break
    case 'dontAsk':
      chips.push(chip('dontask', getModeColor('dontAsk'), active))
      break
    case 'auto':
      chips.push(chip('auto', getModeColor('auto'), active))
      break
    case 'default':
    case undefined:
      chips.push(chip('ask', getModeColor('default'), active))
      break
    default:
      break
  }

  return chips
}

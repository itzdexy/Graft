import type { LocalCommandCall } from '../../types/command.js'
import { formatCrushShortcuts } from '../../services/graft/ecosystem/adapters/crush.js'
import {
  isCrushModeEnabled,
  setCrushModeEnabled,
} from '../../services/graft/ecosystem/crush/state.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalCommandCall = async (args) => {
  const sub = args.trim().toLowerCase() || 'status'
  const cwd = getCwd()

  if (sub === 'on' || sub === 'enable') {
    setCrushModeEnabled(cwd, true)
    return {
      type: 'text',
      value:
        'Crush compact mode **on** — replies stay bullet-short (footer badge: crush).',
    }
  }

  if (sub === 'off' || sub === 'disable') {
    setCrushModeEnabled(cwd, false)
    return { type: 'text', value: 'Crush compact mode **off**.' }
  }

  if (sub === 'shortcuts' || sub === 'keys') {
    return {
      type: 'text',
      value: `# Crush-style shortcuts\n\n${formatCrushShortcuts()}`,
    }
  }

  const enabled = isCrushModeEnabled(cwd)
  return {
    type: 'text',
    value: [
      `# Crush mode: ${enabled ? '**on**' : 'off'}`,
      '',
      'Terminal-friendly terse output (Charm Crush-inspired).',
      '',
      '- `/crush on` / `off` — toggle for this project',
      '- `/crush shortcuts` — keyboard hints',
      '- `/personality concise` — similar but persona-based',
    ].join('\n'),
  }
}

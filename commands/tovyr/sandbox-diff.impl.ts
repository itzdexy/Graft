import type { LocalCommandCall } from '../../types/command.js'
import {
  captureSandboxDiff,
  discardSandboxDiff,
  formatSandboxStatus,
} from '../../services/tovyr/ecosystem/sandbox/diffReview.js'
import { getCwd } from '../../utils/cwd.js'

export const call: LocalCommandCall = async (args) => {
  const sub = args.trim().toLowerCase() || 'status'
  const cwd = getCwd()

  switch (sub) {
    case 'capture':
    case 'snap': {
      const r = await captureSandboxDiff(cwd)
      return { type: 'text', value: r.message }
    }
    case 'discard':
    case 'clear': {
      const msg = await discardSandboxDiff(cwd)
      return { type: 'text', value: msg }
    }
    case 'status':
    default:
      return { type: 'text', value: formatSandboxStatus(cwd) }
  }
}

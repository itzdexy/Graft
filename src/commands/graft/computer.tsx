import type { Command, LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import {
  formatGraftComputerStatus,
  getGraftComputerStatus,
  writeGraftComputerUseConfig,
} from '../../services/graft/computer/state.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  args: string,
): Promise<null> {
  const sub = args.trim().toLowerCase()
  if (sub === 'enable') {
    if (process.platform !== 'win32') {
      onDone(formatGraftComputerStatus(), { display: 'system' })
      return null
    }
    writeGraftComputerUseConfig({ enabled: true })
    const status = getGraftComputerStatus()
    onDone(
      `${formatGraftComputerStatus()}\n\n${status.hostInstalled ? 'Computer use beta enabled.' : 'Feature enabled, but no signed host is installed. Graft will not fall back to an unsigned or foreign host.'}`,
      { display: 'system' },
    )
    return null
  }
  if (sub === 'disable') {
    writeGraftComputerUseConfig({ enabled: false })
    onDone(formatGraftComputerStatus(), { display: 'system' })
    return null
  }
  onDone(
    `${formatGraftComputerStatus()}\n\nCommands: /computer enable · /computer disable · /computer status`,
    { display: 'system' },
  )
  return null
}

const computer: Command = {
  type: 'local-jsx',
  name: 'computer',
  description: 'Guarded Windows computer-use beta status and controls',
  argumentHint: 'status|enable|disable',
  // The implementation is already loaded; self-imports break Bun's split bundle.
  load: async () => ({ call }),
}

export default computer

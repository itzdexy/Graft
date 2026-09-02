import type { Command, LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import {
  formatTovyrComputerStatus,
  getTovyrComputerStatus,
  writeTovyrComputerUseConfig,
} from '../../services/tovyr/computer/state.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  args: string,
): Promise<null> {
  const sub = args.trim().toLowerCase()
  if (sub === 'enable') {
    if (process.platform !== 'win32') {
      onDone(formatTovyrComputerStatus(), { display: 'system' })
      return null
    }
    writeTovyrComputerUseConfig({ enabled: true })
    const status = getTovyrComputerStatus()
    onDone(
      `${formatTovyrComputerStatus()}\n\n${status.hostInstalled ? 'Computer use beta enabled.' : 'Feature enabled, but no signed host is installed. Tovyr will not fall back to an unsigned or foreign host.'}`,
      { display: 'system' },
    )
    return null
  }
  if (sub === 'disable') {
    writeTovyrComputerUseConfig({ enabled: false })
    onDone(formatTovyrComputerStatus(), { display: 'system' })
    return null
  }
  onDone(
    `${formatTovyrComputerStatus()}\n\nCommands: /computer enable · /computer disable · /computer status`,
    { display: 'system' },
  )
  return null
}

const computer: Command = {
  type: 'local-jsx',
  name: 'computer',
  description: 'Guarded Windows computer-use beta status and controls',
  argumentHint: 'status|enable|disable',
  load: () => import('./computer.js'),
}

export default computer

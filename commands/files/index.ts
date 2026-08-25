import type { Command } from '../../commands.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'

const files = {
  type: 'local',
  name: 'files',
  description: 'Open the project file map and list files currently in context',
  isEnabled: () => isTovyrRuntime() || process.env.USER_TYPE === 'ant',
  supportsNonInteractive: true,
  load: () => import('./files.js'),
} satisfies Command

export default files

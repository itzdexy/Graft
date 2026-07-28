import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'
import { isTovyrWebSubscriber } from '../../utils/auth.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'

const command: Command = {
  name: 'chrome',
  description: 'Tovyr in Chrome settings and extension setup',
  isEnabled: () =>
    !getIsNonInteractiveSession() &&
    !isTovyrRuntime() &&
    (process.env.USER_TYPE === 'ant' || isTovyrWebSubscriber()),
  type: 'local-jsx',
  load: () => import('./chrome.js'),
}

export default command

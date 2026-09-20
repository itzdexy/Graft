import type { Command } from '../../commands.js'

import { isGraftWebOnlyCommandEnabled } from '../../utils/graftRuntime.js'

function isSupportedPlatform(): boolean {
  if (process.platform === 'darwin') {
    return true
  }
  if (process.platform === 'win32' && process.arch === 'x64') {
    return true
  }
  return false
}

const desktop = {
  type: 'local-jsx',
  name: 'desktop',
  aliases: ['app'],
  description: 'Continue the current session in Graft on desktop',
  availability: ['claude-ai'],
  isEnabled: () => isGraftWebOnlyCommandEnabled() && isSupportedPlatform(),
  get isHidden() {
    return !isSupportedPlatform()
  },
  load: () => import('./desktop.js'),
} satisfies Command

export default desktop

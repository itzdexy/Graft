import type { Command } from '../../commands.js'

import { isTovyrWebOnlyCommandEnabled } from '../../utils/tovyrRuntime.js'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: 'Show QR code to download the Tovyr mobile app',
  isEnabled: () => isTovyrWebOnlyCommandEnabled(),
  load: () => import('./mobile.js'),
} satisfies Command

export default mobile

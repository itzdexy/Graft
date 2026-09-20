import type { Command } from '../../commands.js'

import { isGraftWebOnlyCommandEnabled } from '../../utils/graftRuntime.js'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: 'Show QR code to download the Graft mobile app',
  isEnabled: () => isGraftWebOnlyCommandEnabled(),
  load: () => import('./mobile.js'),
} satisfies Command

export default mobile

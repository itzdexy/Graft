import type { Command } from '../../commands.js'

import { isBlinkWebOnlyCommandEnabled } from '../../utils/blinkRuntime.js'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: 'Show QR code to download the Blink mobile app',
  isEnabled: () => isBlinkWebOnlyCommandEnabled(),
  load: () => import('./mobile.js'),
} satisfies Command

export default mobile

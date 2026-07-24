import type { Command } from '../../commands.js'
import { formatIntegrationsList } from '../../services/blink/integrations/catalog.js'

const integrations: Command = {
  type: 'local',
  name: 'integrations',
  aliases: ['pack', 'blink-pack'],
  description: 'List third-party skills and tools bundled into Blink',
  supportsNonInteractive: true,
  load: () => import('./integrations.impl.js'),
}

export default integrations

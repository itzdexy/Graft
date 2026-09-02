import type { Command } from '../../commands.js'
import { formatIntegrationsList } from '../../services/tovyr/integrations/catalog.js'

const integrations: Command = {
  type: 'local',
  name: 'integrations',
  aliases: ['pack', 'tovyr-pack'],
  description: 'List third-party skills and tools bundled into Tovyr',
  supportsNonInteractive: true,
  load: () => import('./integrations.impl.js'),
}

export default integrations

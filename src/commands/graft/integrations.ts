import type { Command } from '../../commands.js'
import { formatIntegrationsList } from '../../services/graft/integrations/catalog.js'

const integrations: Command = {
  type: 'local',
  name: 'integrations',
  aliases: ['pack', 'graft-pack'],
  description: 'List third-party skills and tools bundled into Graft',
  supportsNonInteractive: true,
  load: () => import('./integrations.impl.js'),
}

export default integrations

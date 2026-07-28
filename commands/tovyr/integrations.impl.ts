import type { LocalCommandCall } from '../../types/command.js'
import { formatIntegrationsList } from '../../services/tovyr/integrations/catalog.js'

export const call: LocalCommandCall = async () => ({
  type: 'text',
  value: formatIntegrationsList(),
})

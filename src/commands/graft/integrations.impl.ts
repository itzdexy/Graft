import type { LocalCommandCall } from '../../types/command.js'
import { formatIntegrationsList } from '../../services/graft/integrations/catalog.js'

export const call: LocalCommandCall = async () => ({
  type: 'text',
  value: formatIntegrationsList(),
})

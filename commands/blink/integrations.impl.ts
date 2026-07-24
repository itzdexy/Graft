import type { LocalCommandCall } from '../../types/command.js'
import { formatIntegrationsList } from '../../services/blink/integrations/catalog.js'

export const call: LocalCommandCall = async () => ({
  type: 'text',
  value: formatIntegrationsList(),
})

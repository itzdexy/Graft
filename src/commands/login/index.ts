import type { Command } from '../../commands.js'
import { hasAnthropicApiKeyAuth } from '../../utils/auth.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: hasAnthropicApiKeyAuth()
      ? 'Update your FreeModel API key'
      : 'Connect your FreeModel API key',
    isEnabled: () =>
      !isEnvTruthy(process.env.DISABLE_LOGIN_COMMAND) &&
      !(process.env.TOVYR_PACKAGE_ROOT || process.env.TOVYR_SRC),
    load: () => import('./login.js'),
  }) satisfies Command

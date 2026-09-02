import type { Command } from '../../commands.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default {
  type: 'local-jsx',
  name: 'logout',
  description: 'Sign out from your Tovyr account',
  isEnabled: () =>
    !isEnvTruthy(process.env.DISABLE_LOGOUT_COMMAND) &&
    !(process.env.TOVYR_PACKAGE_ROOT || process.env.TOVYR_SRC),
  load: () => import('./logout.js'),
} satisfies Command

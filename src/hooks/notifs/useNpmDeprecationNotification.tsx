import { isInBundledMode } from 'src/utils/bundledMode.js'
import { isGraftRuntime } from 'src/utils/graftRuntime.js'
import { getCurrentInstallationType } from 'src/utils/doctorDiagnostic.js'
import { isEnvTruthy } from 'src/utils/envUtils.js'
import { useStartupNotification } from './useStartupNotification.js'

const NPM_DEPRECATION_MESSAGE =
  'Graft has switched from npm to native installer. Run `graft install` or see https://docs.anthropic.com/en/docs/claude-code/getting-started for more options.'

export function useNpmDeprecationNotification(): void {
  useStartupNotification(async () => {
    if (isGraftRuntime()) return null
    if (
      isInBundledMode() ||
      isEnvTruthy(process.env.DISABLE_INSTALLATION_CHECKS)
    ) {
      return null
    }
    const installationType = await getCurrentInstallationType()
    if (installationType === 'development') return null
    return {
      timeoutMs: 15000,
      key: 'npm-deprecation-warning',
      text: NPM_DEPRECATION_MESSAGE,
      color: 'warning',
      priority: 'high',
    }
  })
}

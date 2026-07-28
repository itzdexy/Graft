import { isInBundledMode } from 'src/utils/bundledMode.js'
import { isTovyrRuntime } from 'src/utils/tovyrRuntime.js'
import { getCurrentInstallationType } from 'src/utils/doctorDiagnostic.js'
import { isEnvTruthy } from 'src/utils/envUtils.js'
import { useStartupNotification } from './useStartupNotification.js'

const NPM_DEPRECATION_MESSAGE =
  'Tovyr has switched from npm to native installer. Run `tovyr install` or see https://docs.anthropic.com/en/docs/claude-code/getting-started for more options.'

export function useNpmDeprecationNotification(): void {
  useStartupNotification(async () => {
    if (isTovyrRuntime()) return null
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

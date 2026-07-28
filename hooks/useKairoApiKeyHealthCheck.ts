import { useEffect, useRef } from 'react'
import {
  TOVYR_API_KEY_CHECK_INTERVAL_MS,
  checkTovyrApiKeyHealthIfDue,
  resetApiKeyHealthCheckClock,
} from '../services/kairo/apiKeyHealthCheck.js'
import { isTovyrRuntime } from '../utils/kairoRuntime.js'

type Options = {
  onInvalid?: () => void
}

/**
 * Re-check the active provider API key every 5 minutes using a free models-list
 * probe (no chat completion, no token spend).
 */
export function useTovyrApiKeyHealthCheck(options: Options = {}): void {
  const onInvalidRef = useRef(options.onInvalid)
  onInvalidRef.current = options.onInvalid

  useEffect(() => {
    if (!isTovyrRuntime()) return

    resetApiKeyHealthCheckClock()

    const run = async () => {
      const status = await checkTovyrApiKeyHealthIfDue({ force: true })
      if (status === 'invalid') {
        onInvalidRef.current?.()
      }
    }

    void run()

    const timer = setInterval(() => {
      void checkTovyrApiKeyHealthIfDue().then(status => {
        if (status === 'invalid') {
          onInvalidRef.current?.()
        }
      })
    }, TOVYR_API_KEY_CHECK_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [])
}

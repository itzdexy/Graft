import { useEffect, useRef } from 'react'
import {
  TOVYR_API_KEY_CHECK_INTERVAL_MS,
  checkTovyrApiKeyHealthIfDue,
  resetApiKeyHealthCheckClock,
} from '../services/tovyr/apiKeyHealthCheck.js'
import { isTovyrRuntime } from '../utils/tovyrRuntime.js'

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

    const handleStatus = (status: Awaited<ReturnType<typeof checkTovyrApiKeyHealthIfDue>>) => {
      if (status === 'invalid') {
        onInvalidRef.current?.()
      }
    }

    const run = async () => {
      try {
        const status = await checkTovyrApiKeyHealthIfDue({ force: true })
        handleStatus(status)
      } catch {
        // Network blips should not crash the REPL; next interval will retry.
      }
    }

    void run()

    const timer = setInterval(() => {
      void checkTovyrApiKeyHealthIfDue()
        .then(handleStatus)
        .catch(() => {
          // Ignore transient probe failures between intervals.
        })
    }, TOVYR_API_KEY_CHECK_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [])
}

import { useEffect, useRef } from 'react'
import {
  GRAFT_API_KEY_CHECK_INTERVAL_MS,
  checkGraftApiKeyHealthIfDue,
  resetApiKeyHealthCheckClock,
} from '../services/graft/apiKeyHealthCheck.js'
import { isGraftRuntime } from '../utils/graftRuntime.js'

type Options = {
  onInvalid?: () => void
}

/**
 * Re-check the active provider API key every 5 minutes using a free models-list
 * probe (no chat completion, no token spend).
 */
export function useGraftApiKeyHealthCheck(options: Options = {}): void {
  const onInvalidRef = useRef(options.onInvalid)
  onInvalidRef.current = options.onInvalid

  useEffect(() => {
    if (!isGraftRuntime()) return

    resetApiKeyHealthCheckClock()

    const handleStatus = (status: Awaited<ReturnType<typeof checkGraftApiKeyHealthIfDue>>) => {
      if (status === 'invalid') {
        onInvalidRef.current?.()
      }
    }

    const run = async () => {
      try {
        const status = await checkGraftApiKeyHealthIfDue({ force: true })
        handleStatus(status)
      } catch {
        // Network blips should not crash the REPL; next interval will retry.
      }
    }

    void run()

    const timer = setInterval(() => {
      void checkGraftApiKeyHealthIfDue()
        .then(handleStatus)
        .catch(() => {
          // Ignore transient probe failures between intervals.
        })
    }, GRAFT_API_KEY_CHECK_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [])
}

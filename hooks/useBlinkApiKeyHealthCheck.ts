import { useEffect, useRef } from 'react'
import {
  BLINK_API_KEY_CHECK_INTERVAL_MS,
  checkBlinkApiKeyHealthIfDue,
  resetApiKeyHealthCheckClock,
} from '../services/blink/apiKeyHealthCheck.js'
import { isBlinkRuntime } from '../utils/blinkRuntime.js'

type Options = {
  onInvalid?: () => void
}

/**
 * Re-check the active provider API key every 5 minutes using a free models-list
 * probe (no chat completion, no token spend).
 */
export function useBlinkApiKeyHealthCheck(options: Options = {}): void {
  const onInvalidRef = useRef(options.onInvalid)
  onInvalidRef.current = options.onInvalid

  useEffect(() => {
    if (!isBlinkRuntime()) return

    resetApiKeyHealthCheckClock()

    const handleStatus = (status: Awaited<ReturnType<typeof checkBlinkApiKeyHealthIfDue>>) => {
      if (status === 'invalid') {
        onInvalidRef.current?.()
      }
    }

    const run = async () => {
      try {
        const status = await checkBlinkApiKeyHealthIfDue({ force: true })
        handleStatus(status)
      } catch {
        // Network blips should not crash the REPL; next interval will retry.
      }
    }

    void run()

    const timer = setInterval(() => {
      void checkBlinkApiKeyHealthIfDue()
        .then(handleStatus)
        .catch(() => {
          // Ignore transient probe failures between intervals.
        })
    }, BLINK_API_KEY_CHECK_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [])
}

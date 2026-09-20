import { useEffect, useState } from 'react'
import {
  type GraftWebLimits,
  currentLimits,
  statusListeners,
} from './graftWebLimits.js'

export function useGraftWebLimits(): GraftWebLimits {
  const [limits, setLimits] = useState<GraftWebLimits>({ ...currentLimits })

  useEffect(() => {
    const listener = (newLimits: GraftWebLimits) => {
      setLimits({ ...newLimits })
    }
    statusListeners.add(listener)

    return () => {
      statusListeners.delete(listener)
    }
  }, [])

  return limits
}

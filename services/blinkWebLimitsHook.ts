import { useEffect, useState } from 'react'
import {
  type BlinkWebLimits,
  currentLimits,
  statusListeners,
} from './blinkWebLimits.js'

export function useBlinkWebLimits(): BlinkWebLimits {
  const [limits, setLimits] = useState<BlinkWebLimits>({ ...currentLimits })

  useEffect(() => {
    const listener = (newLimits: BlinkWebLimits) => {
      setLimits({ ...newLimits })
    }
    statusListeners.add(listener)

    return () => {
      statusListeners.delete(listener)
    }
  }, [])

  return limits
}

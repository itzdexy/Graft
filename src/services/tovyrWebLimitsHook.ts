import { useEffect, useState } from 'react'
import {
  type TovyrWebLimits,
  currentLimits,
  statusListeners,
} from './tovyrWebLimits.js'

export function useTovyrWebLimits(): TovyrWebLimits {
  const [limits, setLimits] = useState<TovyrWebLimits>({ ...currentLimits })

  useEffect(() => {
    const listener = (newLimits: TovyrWebLimits) => {
      setLimits({ ...newLimits })
    }
    statusListeners.add(listener)

    return () => {
      statusListeners.delete(listener)
    }
  }, [])

  return limits
}

import { useEffect, useState } from 'react'
import { isBlinkRuntime } from '../components/LogoV2/blinkFeedConfigs.js'
import { stopBlinkStartupLoader } from '../utils/blinkStartupLoader.js'

/** Brief Ink splash after stderr loader clears — near-instant to avoid blocking. */
const BOOT_SCREEN_MS = 400

/** Clears the stderr loader and shows a minimal boot flash on first paint. */
export function useBlinkBootScreen(): boolean {
  const [visible, setVisible] = useState(() => isBlinkRuntime())

  useEffect(() => {
    if (!isBlinkRuntime()) return
    stopBlinkStartupLoader()
    const timer = setTimeout(() => setVisible(false), BOOT_SCREEN_MS)
    return () => clearTimeout(timer)
  }, [])

  return visible
}

import { useEffect, useState } from 'react'
import { isGraftRuntime } from '../components/LogoV2/graftFeedConfigs.js'
import { stopGraftStartupLoader } from '../utils/graftStartupLoader.js'

/** Brief Ink splash after stderr loader clears — near-instant to avoid blocking. */
const BOOT_SCREEN_MS = 400

/** Clears the stderr loader and shows a minimal boot flash on first paint. */
export function useGraftBootScreen(): boolean {
  const [visible, setVisible] = useState(() => isGraftRuntime())

  useEffect(() => {
    if (!isGraftRuntime()) return
    stopGraftStartupLoader()
    const timer = setTimeout(() => setVisible(false), BOOT_SCREEN_MS)
    return () => clearTimeout(timer)
  }, [])

  return visible
}

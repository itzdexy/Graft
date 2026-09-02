import { useEffect, useState } from 'react'
import { isTovyrRuntime } from '../components/LogoV2/tovyrFeedConfigs.js'
import { stopTovyrStartupLoader } from '../utils/tovyrStartupLoader.js'

/** Brief Ink splash after stderr loader clears — near-instant to avoid blocking. */
const BOOT_SCREEN_MS = 400

/** Clears the stderr loader and shows a minimal boot flash on first paint. */
export function useTovyrBootScreen(): boolean {
  const [visible, setVisible] = useState(() => isTovyrRuntime())

  useEffect(() => {
    if (!isTovyrRuntime()) return
    stopTovyrStartupLoader()
    const timer = setTimeout(() => setVisible(false), BOOT_SCREEN_MS)
    return () => clearTimeout(timer)
  }, [])

  return visible
}

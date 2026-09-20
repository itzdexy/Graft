import React from 'react'
import { Text } from '../../ink.js'

/** Minimal footer panel when WEB_BROWSER_TOOL is enabled (Phase 2/11). */
export function WebBrowserPanel(): React.ReactElement | null {
  const hasWebView =
    typeof Bun !== 'undefined' && 'WebView' in (Bun as object)
  if (!hasWebView) return null
  return (
    <Text dimColor>
      WebBrowser: Bun WebView available — use WebBrowser tool or /browser read
    </Text>
  )
}

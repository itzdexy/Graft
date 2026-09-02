import * as React from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { BREAKPOINTS, getBreakpoint, type Breakpoint } from './spacing.js'

type Props = {
  children: React.ReactNode | ((bp: Breakpoint, rows: number) => React.ReactNode)
  hideBelow?: number
  hideBelowRows?: number
}

/**
 * Wrapper that exposes the current breakpoint and terminal dimensions to
 * children. When `hideBelow` or `hideBelowRows` is set, the component renders
 * nothing if the terminal is narrower/shorter than the threshold.
 */
export function ResponsiveLayout({
  children,
  hideBelow,
  hideBelowRows,
}: Props): React.ReactNode {
  const { columns, rows } = useTerminalSize()
  const bp = getBreakpoint(columns)

  if (hideBelow && columns < hideBelow) return null
  if (hideBelowRows && rows < hideBelowRows) return null

  if (typeof children === 'function') {
    return children(bp, rows)
  }
  return children
}

export { BREAKPOINTS, getBreakpoint, type Breakpoint }

import { memo, useEffect, useState, useCallback, type ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'

export type BlinkNotification = {
  id: string
  text: string
  color?: string
  timeoutMs?: number
}

type Props = {
  notifications: BlinkNotification[]
  onDismiss: (id: string) => void
}

const DEFAULT_TIMEOUT = 4000

/** Temporary toast notifications — non-blocking, auto-dismiss. */
export const BlinkNotifications = memo(function BlinkNotifications({
  notifications,
  onDismiss,
}: Props): ReactNode {
  const { columns } = useTerminalSize()

  useEffect(() => {
    for (const n of notifications) {
      const timeout = n.timeoutMs ?? DEFAULT_TIMEOUT
      const timer = setTimeout(() => onDismiss(n.id), timeout)
      return () => clearTimeout(timer)
    }
  }, [notifications, onDismiss])

  if (notifications.length === 0) return null

  return (
    <Box flexDirection="column" width={columns} paddingX={1}>
      {notifications.map(n => (
        <Box key={n.id} flexDirection="row">
          <Text color={n.color ?? 'blinkPrimary'} bold>{'! '}</Text>
          <Text color={n.color ?? 'text'}>{n.text}</Text>
        </Box>
      ))}
    </Box>
  )
})

/** Hook to manage notification state. */
export function useBlinkNotifications() {
  const [notifications, setNotifications] = useState<BlinkNotification[]>([])

  const addNotification = useCallback((n: Omit<BlinkNotification, 'id'> & { id?: string }) => {
    const id = n.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setNotifications(prev => {
      if (prev.some(p => p.id === id)) return prev
      return [...prev, { ...n, id }]
    })
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  return { notifications, addNotification, dismissNotification }
}

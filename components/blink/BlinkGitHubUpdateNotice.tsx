import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Box, Text } from '../../ink.js'
import {
  checkForBlinkUpdate,
  isInstalledBlinkRuntime,
  prepareBlinkUpdate,
  type BlinkUpdate,
} from '../../services/blink/githubUpdater.js'

const CHECK_INTERVAL_MS = 30 * 60 * 1000

type Status = 'idle' | 'preparing' | 'ready' | 'error'

export function BlinkGitHubUpdateNotice(): React.ReactNode {
  const [update, setUpdate] = useState<BlinkUpdate | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isInstalledBlinkRuntime()) return
    let active = true
    const check = async () => {
      try {
        const result = await checkForBlinkUpdate()
        if (active) setUpdate(result)
      } catch {
        // Update checks stay quiet when offline or GitHub is unavailable.
      }
    }
    void check()
    const interval = setInterval(() => void check(), CHECK_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const install = useCallback(async () => {
    if (!update || status !== 'idle') return
    setStatus('preparing')
    setError('')
    try {
      await prepareBlinkUpdate(update)
      setStatus('ready')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('error')
    }
  }, [status, update])

  if (!update) return null
  if (status === 'ready') {
    return <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="cyan">Update ready</Text>
        <Text dimColor> · Exit and reopen Blink to finish.</Text>
      </Box>
  }
  if (status === 'error') {
    return <Box borderStyle="round" borderColor="red" paddingX={1}>
        <Text color="red">Update failed</Text>
        <Text dimColor> · {error} · Run /update to retry.</Text>
      </Box>
  }
  return <Box borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text color="cyan">Blink update</Text>
      <Text dimColor> · {update.title} · {update.shortSha} </Text>
      <Box onClick={() => void install()}>
        <Text inverse color="cyan">
          {status === 'preparing' ? ' Preparing… ' : ' Update now '}
        </Text>
      </Box>
    </Box>
}

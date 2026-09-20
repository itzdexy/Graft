import { useEffect, useState } from 'react'
import { Box, Text } from '../../ink.js'
import { Spinner } from '../Spinner.js'
import {
  isCodexCliLoggedIn,
  startCodexCliLogin,
} from '../../services/graft/codexCliProvider.js'

type Props = {
  onConnected(): void
}

export function CodexAccountLogin({ onConnected }: Props): React.ReactNode {
  const [status, setStatus] = useState('Checking the official Codex login...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let loginProcess: ReturnType<typeof startCodexCliLogin> | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const finishIfLoggedIn = async (): Promise<boolean> => {
      const loggedIn = await isCodexCliLoggedIn()
      if (!cancelled && loggedIn) {
        onConnected()
        return true
      }
      return false
    }

    void (async () => {
      if (await finishIfLoggedIn()) return

      setStatus('Opening ChatGPT in your browser...')
      try {
        loginProcess = startCodexCliLogin()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
        return
      }

      loginProcess.once('error', cause => {
        if (!cancelled) {
          setError(
            `Could not start Codex login: ${cause.message}. Install the official Codex CLI and retry.`,
          )
        }
      })

      const poll = async (): Promise<void> => {
        if (cancelled) return
        if (await finishIfLoggedIn()) return
        setStatus('Waiting for ChatGPT login in your browser...')
        timer = setTimeout(() => void poll(), 1_000)
      }
      timer = setTimeout(() => void poll(), 1_000)
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      loginProcess?.kill()
    }
  }, [onConnected])

  return (
    <Box flexDirection="column">
      {error ? (
        <>
          <Text color="error">ChatGPT login failed.</Text>
          <Text dimColor>{error}</Text>
        </>
      ) : (
        <Box>
          <Spinner />
          <Text>{status}</Text>
        </Box>
      )}
      <Text dimColor>
        Graft uses the installed Codex CLI as the transport. It never reads or
        copies your ChatGPT tokens.
      </Text>
    </Box>
  )
}

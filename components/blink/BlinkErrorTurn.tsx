import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { startsWithApiErrorPrefix } from '../../services/api/errors.js'
import { isRateLimitErrorMessage } from '../../services/rateLimitMessages.js'
import { BlinkChatTurn } from './BlinkChatTurn.js'

const MAX_ERROR_CHARS = 800

type ErrorKind = 'rate-limit' | 'api-error' | 'request-too-large' | 'generic'

function classifyError(text: string): ErrorKind {
  const trimmed = text.trim()
  if (isRateLimitErrorMessage(trimmed)) return 'rate-limit'
  if (startsWithApiErrorPrefix(trimmed)) return 'api-error'
  if (/^Request too large/i.test(trimmed)) return 'request-too-large'
  return 'generic'
}

const ERROR_HINTS: Record<ErrorKind, { label: string; hints: string[] }> = {
  'rate-limit': {
    label: 'Rate limited',
    hints: ['Wait a moment', 'Try /model for a different provider', 'Check usage limits'],
  },
  'api-error': {
    label: 'Request issue',
    hints: ['Check API key', 'Try /model to switch providers', 'Run blink doctor'],
  },
  'request-too-large': {
    label: 'Request too large',
    hints: ['Try with a smaller file', 'Remove large attachments', 'Press Esc to go back'],
  },
  generic: {
    label: 'Something went wrong',
    hints: ['Try /model', 'Check API key', 'Run blink doctor'],
  },
}

type Props = {
  text: string
  addMargin?: boolean
}

export function isBlinkErrorDisplayText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (isRateLimitErrorMessage(trimmed)) return true
  if (startsWithApiErrorPrefix(trimmed)) return true
  if (/^Request too large/i.test(trimmed)) return true
  if (/^Error:\s/i.test(trimmed) && trimmed.length < 600) return true
  return false
}

function summarizeError(text: string): { title: string; body: string; kind: ErrorKind } {
  const trimmed = text.trim()
  const kind = classifyError(trimmed)
  const title = ERROR_HINTS[kind].label

  if (kind === 'rate-limit') {
    return { title, body: trimmed, kind }
  }
  if (kind === 'api-error') {
    const body = trimmed.replace(/^API Error:\s*/i, '').trim()
    return { title, body, kind }
  }
  if (kind === 'request-too-large') {
    return { title, body: trimmed, kind }
  }
  return {
    title,
    body:
      trimmed.length > MAX_ERROR_CHARS
        ? `${trimmed.slice(0, MAX_ERROR_CHARS)}...`
        : trimmed,
    kind,
  }
}

/** Error turn with clear title + readable body (Blink runtime). */
export function BlinkErrorTurn({ text, addMargin = false }: Props): ReactNode {
  const { title, body, kind } = summarizeError(text)
  const hints = ERROR_HINTS[kind].hints

  return (
    <BlinkChatTurn role="blink" addMargin={addMargin} variant="error">
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text color="error" bold>{'! '}</Text>
          <Text color="error" bold>
            {title}
          </Text>
        </Box>
        <Box marginTop={0}>
          <Text color="error" dimColor wrap="wrap">
            {body}
          </Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {hints.map((hint, i) => (
            <Text key={i} color="subtle" dimColor>
              <Text color="blinkPrimary" bold>{'> '}</Text>
              {hint.includes('/') || hint.includes('blink') ? (
                <>
                  {hint.replace(/(\/\w+|blink \w+)/g, '')}
                  {hint.match(/(\/\w+|blink \w+)/g)?.map((cmd, j) => (
                    <Text key={j} color="blinkPrimary" bold>{cmd}</Text>
                  ))}
                </>
              ) : (
                <Text color="blinkPrimary">{hint}</Text>
              )}
            </Text>
          ))}
        </Box>
      </Box>
    </BlinkChatTurn>
  )
}

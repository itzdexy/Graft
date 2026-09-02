import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { startsWithApiErrorPrefix } from '../../services/api/errors.js'
import { isRateLimitErrorMessage } from '../../services/rateLimitMessages.js'
import { TovyrChatTurn } from './TovyrChatTurn.js'

const MAX_ERROR_CHARS = 800

type ErrorKind =
  | 'rate-limit'
  | 'credits-depleted'
  | 'api-error'
  | 'context-length'
  | 'request-too-large'
  | 'generic'

function formatCleanErrorMessage(raw: string): string {
  let cleaned = raw.trim().replace(/^\d{3}\s+/, '')
  let current = cleaned
  for (let i = 0; i < 3; i++) {
    if (
      typeof current === 'string' &&
      ((current.startsWith('{') && current.endsWith('}')) ||
        (current.startsWith('[') && current.endsWith(']')))
    ) {
      try {
        const parsed = JSON.parse(current)
        if (parsed && typeof parsed === 'object') {
          if (parsed.message) {
            current = String(parsed.message)
            continue
          }
          if (parsed.error) {
            if (typeof parsed.error === 'string') {
              current = parsed.error
              continue
            }
            if (typeof parsed.error === 'object' && parsed.error.message) {
              current = String(parsed.error.message)
              continue
            }
          }
        }
      } catch {
        break
      }
    }
  }
  return typeof current === 'string' ? current : raw
}

function classifyError(text: string): ErrorKind {
  const trimmed = text.trim()
  if (isRateLimitErrorMessage(trimmed)) return 'rate-limit'
  if (/depleted|credits|quota|billing|402/i.test(trimmed)) return 'credits-depleted'
  if (/^Prompt is too long/i.test(trimmed)) return 'context-length'
  if (startsWithApiErrorPrefix(trimmed)) return 'api-error'
  if (/^Request too large/i.test(trimmed)) return 'request-too-large'
  return 'generic'
}

const ERROR_HINTS: Record<ErrorKind, { label: string; hints: string[] }> = {
  'rate-limit': {
    label: 'Rate limited',
    hints: ['Wait for provider reset', 'Use /provider to switch providers', 'Run /doctor provider'],
  },
  'credits-depleted': {
    label: 'Credits depleted',
    hints: [
      'Use /model and pick Haiku (or another free tier)',
      'Use /provider to switch to NVIDIA NIM or another key',
      'Run tovyr doctor',
    ],
  },
  'api-error': {
    label: 'Request issue',
    hints: ['Check API key with /provider', 'Try /model to switch providers', 'Run tovyr doctor'],
  },
  'context-length': {
    label: 'Context is full',
    hints: ['Run /compact', 'Use /clear to start fresh', 'Try a larger-context model with /model'],
  },
  'request-too-large': {
    label: 'Request too large',
    hints: ['Try with a smaller file', 'Remove large attachments', 'Press Esc to go back'],
  },
  generic: {
    label: 'Something went wrong',
    hints: ['Try /model', 'Check API key with /provider', 'Run tovyr doctor'],
  },
}

type Props = {
  text: string
  addMargin?: boolean
}

export function isTovyrErrorDisplayText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (isRateLimitErrorMessage(trimmed)) return true
  if (startsWithApiErrorPrefix(trimmed)) return true
  if (/^Prompt is too long/i.test(trimmed)) return true
  if (/^Request too large/i.test(trimmed)) return true
  if (/depleted|credits|quota|billing/i.test(trimmed)) return true
  if (/^\d{3}\s+\{/i.test(trimmed)) return true
  if (/^Invalid API key/i.test(trimmed)) return true
  if (/^Error:\s/i.test(trimmed) && trimmed.length < 600) return true
  return false
}

function summarizeError(text: string): { title: string; body: string; kind: ErrorKind } {
  const trimmed = text.trim()
  const kind = classifyError(trimmed)
  const title = ERROR_HINTS[kind].label
  const clean = formatCleanErrorMessage(trimmed.replace(/^API Error:\s*/i, ''))

  return {
    title,
    body:
      clean.length > MAX_ERROR_CHARS
        ? `${clean.slice(0, MAX_ERROR_CHARS)}...`
        : clean,
    kind,
  }
}

/** Error turn with clear title + readable body (Tovyr runtime). */
export function TovyrErrorTurn({ text, addMargin = false }: Props): ReactNode {
  const { title, body, kind } = summarizeError(text)
  const hints = ERROR_HINTS[kind].hints

  return (
    <TovyrChatTurn role="tovyr" addMargin={addMargin} variant="error">
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
              <Text color="tovyrPrimary" bold>{'> '}</Text>
              {renderHintWithCommands(hint)}
            </Text>
          ))}
        </Box>
      </Box>
    </TovyrChatTurn>
  )
}

function renderHintWithCommands(hint: string): ReactNode {
  const parts = hint.split(/(\/\w+|tovyr \w+)/g)
  if (parts.length === 1) {
    return <Text color="tovyrPrimary">{hint}</Text>
  }
  return (
    <>
      {parts.map((part, index) =>
        /^(\/\w+|tovyr \w+)$/.test(part) ? (
          <Text key={index} color="tovyrPrimary" bold>
            {part}
          </Text>
        ) : (
          <Text key={index}>{part}</Text>
        ),
      )}
    </>
  )
}

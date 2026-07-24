import type { ReactNode } from 'react'
import { Text } from '../../ink.js'
import { BlinkChatTurn } from './BlinkChatTurn.js'

type Props = {
  content: string
  addMargin?: boolean
}

/** Slash command echo in the Blink transcript. */
export function BlinkUserCommandMessage({
  content,
  addMargin = false,
}: Props): ReactNode {
  const trimmed = content.trim()
  if (!trimmed) return null

  const body = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
  const [command, ...rest] = body.split(/\s+/)
  const args = rest.join(' ')

  return (
    <BlinkChatTurn role="you" addMargin={addMargin}>
      <Text wrap="wrap">
        <Text color="blinkPrimary" bold>
          /{command}
        </Text>
        {args ? (
          <Text color="text" dimColor>
            {' '}
            {args}
          </Text>
        ) : null}
      </Text>
    </BlinkChatTurn>
  )
}

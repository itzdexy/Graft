import type { ReactNode } from 'react'
import { Text } from '../../ink.js'
import { GraftChatTurn } from './GraftChatTurn.js'

type Props = {
  content: string
  addMargin?: boolean
}

/** Slash command echo in the Graft transcript. */
export function GraftUserCommandMessage({
  content,
  addMargin = false,
}: Props): ReactNode {
  const trimmed = content.trim()
  if (!trimmed) return null

  const body = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
  const [command, ...rest] = body.split(/\s+/)
  const args = rest.join(' ')

  // The model picker emits its own concise receipt. Repeating "You | /model"
  // immediately above it makes a local UI action look like a chat exchange.
  if (command === 'model') return null

  return (
    <GraftChatTurn role="you" addMargin={addMargin}>
      <Text wrap="wrap">
        <Text color="graftPrimary" bold>
          /{command}
        </Text>
        {args ? (
          <Text color="text" dimColor>
            {' '}
            {args}
          </Text>
        ) : null}
      </Text>
    </GraftChatTurn>
  )
}

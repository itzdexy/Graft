import type { ReactNode } from 'react'
import { Text } from '../../ink.js'
import { Markdown } from '../Markdown.js'
import { TovyrChatTurn } from './TovyrChatTurn.js'

type Props = {
  text: string
  addMargin?: boolean
}

function formatUserLine(text: string): ReactNode {
  const trimmed = text.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/')) {
    const [command, ...rest] = trimmed.split(/\s+/)
    const args = rest.join(' ')
    return (
      <Text wrap="wrap">
        <Text color="tovyrPrimary" bold>
          {command}
        </Text>
        {args ? (
          <Text color="text" dimColor>
            {' '}
            {args}
          </Text>
        ) : null}
      </Text>
    )
  }

  return <Markdown>{trimmed}</Markdown>
}

/** Chat-style user prompt with role label and left accent. */
export function TovyrUserTextMessage({
  text,
  addMargin = false,
}: Props): ReactNode {
  const body = formatUserLine(text)
  if (!body) return null

  return (
    <TovyrChatTurn role="you" addMargin={addMargin}>
      {body}
    </TovyrChatTurn>
  )
}

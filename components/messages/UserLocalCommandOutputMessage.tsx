import type { ReactNode } from 'react'
import { DIAMOND_FILLED, DIAMOND_OPEN } from '../../constants/figures.js'
import { NO_CONTENT_MESSAGE } from '../../constants/messages.js'
import { Box, Text } from '../../ink.js'
import { extractTag } from '../../utils/messages.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { Markdown } from '../Markdown.js'
import { MessageResponse } from '../MessageResponse.js'
import { BlinkLocalCommandOutput } from '../blink/BlinkLocalCommandOutput.js'

type Props = {
  content: string
  addMargin?: boolean
}

export function UserLocalCommandOutputMessage({
  content,
  addMargin = false,
}: Props): ReactNode {
  if (isBlinkRuntime()) {
    return <BlinkLocalCommandOutput content={content} addMargin={addMargin} />
  }

  const stdout = extractTag(content, 'local-command-stdout')
  const stderr = extractTag(content, 'local-command-stderr')

  if (!stdout && !stderr) {
    return (
      <MessageResponse>
        <Text dimColor>{NO_CONTENT_MESSAGE}</Text>
      </MessageResponse>
    )
  }

  const lines: ReactNode[] = []
  if (stdout?.trim()) {
    lines.push(
      <IndentedContent key="stdout">{stdout.trim()}</IndentedContent>,
    )
  }
  if (stderr?.trim()) {
    lines.push(
      <IndentedContent key="stderr">{stderr.trim()}</IndentedContent>,
    )
  }
  return lines
}

function IndentedContent({ children }: { children: string }): ReactNode {
  if (
    children.startsWith(`${DIAMOND_OPEN} `) ||
    children.startsWith(`${DIAMOND_FILLED} `)
  ) {
    return <CloudLaunchContent>{children}</CloudLaunchContent>
  }

  return (
    <Box flexDirection="row">
      <Text dimColor>{'  ⎿  '}</Text>
      <Box flexDirection="column" flexGrow={1}>
        <Markdown>{children}</Markdown>
      </Box>
    </Box>
  )
}

function CloudLaunchContent({ children }: { children: string }): ReactNode {
  const diamond = children[0]
  const nl = children.indexOf('\n')
  const header = nl === -1 ? children.slice(2) : children.slice(2, nl)
  const rest = nl === -1 ? '' : children.slice(nl + 1).trim()

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="subtle">{diamond} </Text>
        <Text color="text">{header}</Text>
      </Text>
      {rest ? (
        <Box flexDirection="row" marginTop={0}>
          <Text dimColor>{'  ⎿  '}</Text>
          <Box flexDirection="column" flexGrow={1}>
            <Markdown>{rest}</Markdown>
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}

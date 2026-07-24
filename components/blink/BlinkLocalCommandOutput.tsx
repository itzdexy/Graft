import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { extractTag } from '../../utils/messages.js'
import { BlinkChatTurn } from './BlinkChatTurn.js'

type Props = {
  content: string
  addMargin?: boolean
}

function colorizeLine(line: string, index: number): ReactNode {
  const trimmed = line.trimEnd()
  if (!trimmed) return null

  if (/→/.test(trimmed)) {
    const parts = trimmed.split('→')
    return (
      <Text key={`line-${index}`} wrap="wrap">
        <Text color="success" bold>
          {parts[0]}→
        </Text>
        <Text color="blinkPrimary">{parts.slice(1).join('→')}</Text>
      </Text>
    )
  }

  if (/^[└├]/.test(trimmed)) {
    return (
      <Text key={`line-${index}`} wrap="wrap">
        <Text color="subtle" dimColor>
          {trimmed.slice(0, 2)}
        </Text>
        <Text color="text">{trimmed.slice(2).trimStart()}</Text>
      </Text>
    )
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('huggingface.co')) {
    return (
      <Text key={`line-${index}`} color="blinkPrimary" dimColor wrap="wrap">
        <Text color="blinkPrimary" bold>{'> '}</Text>{trimmed}
      </Text>
    )
  }

  if (/^(error|Error|ERROR)[:\s]/.test(trimmed)) {
    return (
      <Text key={`line-${index}`} wrap="wrap">
        <Text color="error" bold>{'! '}</Text>
        <Text color="error" dimColor>{trimmed}</Text>
      </Text>
    )
  }

  if (/^(warning|Warning|WARN)[:\s]/.test(trimmed)) {
    return (
      <Text key={`line-${index}`} wrap="wrap">
        <Text color="warning" bold>{'! '}</Text>
        <Text color="warning" dimColor>{trimmed}</Text>
      </Text>
    )
  }

  if (/^(Tip|TIP)[:\s]/.test(trimmed)) {
    return (
      <Text key={`line-${index}`} wrap="wrap">
        <Text color="blinkPrimary" bold>{'> '}</Text>
        <Text color="blinkPrimary" dimColor>{trimmed}</Text>
      </Text>
    )
  }

  if (/^(Available|Active|Connected|Current|Status)[:\s]/.test(trimmed)) {
    const colonIdx = trimmed.indexOf(': ')
    if (colonIdx > 0 && colonIdx < 28) {
      const key = trimmed.slice(0, colonIdx)
      const rest = trimmed.slice(colonIdx)
      return (
        <Text key={`line-${index}`} wrap="wrap">
          <Text color="blinkPrimary" bold>{'| '}</Text>
          <Text color="blinkPrimary" dimColor bold>{key}</Text>
          <Text color="text" dimColor>{rest}</Text>
        </Text>
      )
    }
  }

  const colonIdx = trimmed.indexOf(': ')
  if (colonIdx > 0 && colonIdx < 24) {
    const key = trimmed.slice(0, colonIdx)
    const rest = trimmed.slice(colonIdx)
    return (
      <Text key={`line-${index}`} wrap="wrap">
        <Text color="blinkPrimary" dimColor bold>
          {key}
        </Text>
        <Text color="text" dimColor>
          {rest}
        </Text>
      </Text>
    )
  }

  if (/^[\-=#]/.test(trimmed)) {
    return (
      <Text key={`line-${index}`} color="subtle" dimColor wrap="wrap">
        {trimmed}
      </Text>
    )
  }

  return (
    <Text key={`line-${index}`} color="text" dimColor wrap="wrap">
      <Text color="subtle" dimColor>{'  '}</Text>{trimmed}
    </Text>
  )
}

/** Styled output from local slash commands (/model, /provider, etc.). */
export function BlinkLocalCommandOutput({
  content,
  addMargin = false,
}: Props): ReactNode {
  const stdout = extractTag(content, 'local-command-stdout')?.trim()
  const stderr = extractTag(content, 'local-command-stderr')?.trim()
  const text = [stdout, stderr].filter(Boolean).join('\n')
  if (!text) return null

  const lines = text
    .split('\n')
    .map((line, index) => colorizeLine(line, index))
    .filter(Boolean)
  if (lines.length === 0) return null

  return (
    <BlinkChatTurn role="system" addMargin={addMargin}>
      <Box flexDirection="column">{lines}</Box>
    </BlinkChatTurn>
  )
}

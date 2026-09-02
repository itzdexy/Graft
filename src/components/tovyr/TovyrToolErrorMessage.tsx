import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { projectToolError } from '../../services/tovyr/dx/toolResultPresentation.js'
import { isRecoverableUnknownSkillResult } from '../../services/tovyr/modelCompatibility.js'

function resultText(content: ToolResultBlockParam['content']): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .flatMap(block => (block.type === 'text' ? [block.text] : []))
    .join('\n')
}

export function TovyrToolErrorMessage({
  content,
  verbose,
}: {
  content: ToolResultBlockParam['content']
  verbose: boolean
}): ReactNode {
  // A model inventing a skill name is a routing miss it recovers from on the
  // next turn, not a failure the user needs to read. The SkillTool has its own
  // quiet renderer for this, but the Tovyr transcript renders tool errors here
  // instead, so it never ran — leaving a red "Unknown skill: deepseek." row.
  if (isRecoverableUnknownSkillResult(content)) {
    return (
      <Text color="subtle" dimColor>
        Skipped an invalid skill call.
      </Text>
    )
  }

  const error = projectToolError(resultText(content))
  return (
    <Box flexDirection="column">
      <Text color="error" bold>{error.summary}</Text>
      {verbose && error.detail !== error.summary ? (
        <Text color="subtle" wrap="wrap">{error.detail}</Text>
      ) : null}
    </Box>
  )
}

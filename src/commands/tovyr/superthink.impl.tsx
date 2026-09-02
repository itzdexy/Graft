import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import * as React from 'react'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { SuperthinkResearchRunner } from './SuperthinkResearchRunner.js'
import { runSuperthink } from '../../services/tovyr/superthink/orchestrator.js'
import { getCwd } from '../../utils/cwd.js'

function blocksToText(blocks: ContentBlockParam[]): string {
  return blocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('\n\n')
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const cwd = getCwd()
  const result = await runSuperthink(cwd, args)

  if (result.mode === 'display') {
    onDone(result.text, { display: 'system' })
    return null
  }

  if (result.mode === 'subagent') {
    return (
      <SuperthinkResearchRunner
        cwd={cwd}
        goal={result.goal}
        context={context}
        canUseTool={context.canUseTool}
        onDone={onDone}
      />
    )
  }

  // The display and subagent variants returned above; only query carries blocks.
  onDone(undefined, {
    shouldQuery: true,
    metaMessages: [blocksToText(result.blocks)],
  })
  return null
}

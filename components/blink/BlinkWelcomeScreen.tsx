import * as React from 'react'
import type { ReactNode } from 'react'
import { Box } from '../../ink.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import type { AgentDefinitionsResult } from '../../tools/AgentTool/loadAgentsDir.js'
import { getContextWindowForModel } from '../../utils/context.js'
import { getSdkBetas } from '../../bootstrap/state.js'
import { getTotalInputTokens, getTotalOutputTokens } from '../../cost-tracker.js'
import { renderModelName, type ModelName } from '../../utils/model/model.js'
import { StatusNotices } from '../StatusNotices.js'
import { WelcomeView } from './WelcomeView.js'

type Props = {
  agentDefinitions?: AgentDefinitionsResult
  isWorking?: boolean
  mode?: string
  thinking?: string
  agent?: string
}

/** Calm, centered startup screen with wordmark, composer, and minimal hints. */
export function BlinkWelcomeScreen({
  agentDefinitions,
  isWorking = false,
  mode = 'Ask',
  thinking,
  agent,
}: Props): ReactNode {
  const mainLoopModel: ModelName = useMainLoopModel()
  const modelText = renderModelName(mainLoopModel)

  const inputTokens = getTotalInputTokens()
  const outputTokens = getTotalOutputTokens()
  const totalTokens = inputTokens + outputTokens
  const contextWindow = getContextWindowForModel(mainLoopModel, getSdkBetas())
  const contextPercent =
    contextWindow > 0 ? Math.min(100, Math.round((totalTokens / contextWindow) * 100)) : 0
  return (
    <Box flexDirection="column" width="100%" paddingX={1}>
      <WelcomeView
        isWorking={isWorking}
        mode={mode}
        model={modelText}
        thinking={thinking}
        agent={agent}
        contextPercent={contextPercent}
        placeholder={isWorking ? 'Blink is working…' : 'Ask Blink anything…'}
      />
      <Box
        flexDirection="column"
        alignItems="center"
        marginTop={1}
        paddingX={1}
      >
        <React.Suspense fallback={null}>
          <StatusNotices agentDefinitions={agentDefinitions} />
        </React.Suspense>
      </Box>
    </Box>
  )
}

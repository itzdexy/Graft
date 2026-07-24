import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Box, Text } from '../../ink.js'
import { loadAgentSession } from '../../services/blink/agent/persistence.js'
import type { AgentStepStatus } from '../../services/blink/agent/types.js'
import { getCwd } from '../../utils/cwd.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import {
  StepProgressIndicator,
  type Step,
  type StepStatus,
} from '../StepProgressIndicator.js'

function mapStatus(status: AgentStepStatus, isCurrent: boolean): StepStatus {
  switch (status) {
    case 'done':
      return 'completed'
    case 'failed':
      return 'error'
    case 'in_progress':
      return 'in_progress'
    case 'skipped':
      return 'completed'
    default:
      return isCurrent ? 'in_progress' : 'pending'
  }
}

type Props = {
  refreshKey?: number
}

/** Agent plan steps above the live activity dock (Blink runtime only). */
export function BlinkAgentStepProgress({ refreshKey = 0 }: Props): ReactNode {
  const steps = useMemo((): Step[] | null => {
    if (!isBlinkRuntime()) return null
    const session = loadAgentSession(getCwd())
    if (!session || session.phase === 'done' || session.phase === 'failed') {
      return null
    }
    return session.steps.map((s, index) => ({
      id: s.id,
      label: s.title,
      status: mapStatus(s.status, index === session.currentStepIndex),
    }))
  }, [refreshKey])

  if (!steps?.length) return null

  const current = steps.find(s => s.status === 'in_progress')?.id
  const doneCount = steps.filter(s => s.status === 'completed').length
  const totalCount = steps.length

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Box flexDirection="row" marginBottom={0} gap={1}>
        <Text color="blinkPrimary" bold>
          {'| '}
        </Text>
        <Text bold color="blinkPrimary">
          Plan
        </Text>
        <Text dimColor color="subtle">
          <Text color="blinkPrimary" bold>{doneCount}</Text>
          {'/'}
          <Text color="subtle">{totalCount}</Text>
          {' steps'}
        </Text>
        {doneCount === totalCount ? (
          <Text color="success" bold>{' *'}</Text>
        ) : null}
      </Box>
      <StepProgressIndicator steps={steps} currentStep={current} />
    </Box>
  )
}

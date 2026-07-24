import * as React from 'react'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Settings } from '../../components/Settings/Settings.js'
import { Pane } from '../../components/design-system/Pane.js'
import { Card } from '../../components/design-system/Card.js'
import { Section } from '../../components/design-system/Section.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import {
  getTotalCost,
  getTotalDuration,
  getTotalInputTokens,
  getTotalOutputTokens,
} from '../../cost-tracker.js'
import { getCwd } from '../../utils/cwd.js'
import { getContextWindowForModel } from '../../utils/context.js'
import {
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  loadState,
} from '../../scripts/blink-providers.js'

declare const MACRO: { VERSION: string }

function activeConnection(): { provider: string; model: string } {
  try {
    const state = loadState()
    const id = getActiveProviderId(state)
    const def = getProvider(id, state)
    const modelId = getActiveModelId(id, state)
    const model = def?.models.find((m: { id: string; label?: string }) => m.id === modelId)?.label || modelId || 'default'
    return { provider: def?.label || id, model }
  } catch {
    return { provider: 'FreeModel', model: 'default' }
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatCost(n: number): string {
  return n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(4)}`
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function ContextBar({ percent, width = 30 }: { percent: number; width?: number }) {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  const empty = width - filled
  const color = percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'permission'
  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text dimColor> {percent}%</Text>
    </Text>
  )
}

function StatusReport(): React.ReactNode {
  const conn = activeConnection()
  const cwd = getCwd()
  const inputTokens = getTotalInputTokens()
  const outputTokens = getTotalOutputTokens()
  const totalTokens = inputTokens + outputTokens
  const contextWindow = getContextWindowForModel(conn.model, [])
  const contextPercent =
    contextWindow > 0 ? Math.min(100, Math.round((totalTokens / contextWindow) * 100)) : 0

  return (
    <Pane color="permission">
      <Card
        title="Blink Status"
        subtitle={`Version ${MACRO.VERSION}`}
        color="permission"
        footer="Run /status --settings to open the Settings panel"
      >
        <Section title="Connection">
          <Text>
            <Text color="permission">{conn.provider}</Text>
            <Text dimColor> · </Text>
            <Text>{conn.model}</Text>
          </Text>
        </Section>

        <Section title="Workspace">
          <Text dimColor>{cwd}</Text>
        </Section>

        <Section title="Cost & Time">
          <Text>Total cost: {formatCost(getTotalCost())}</Text>
          <Text>Wall time: {formatDuration(getTotalDuration())}</Text>
        </Section>

        <Section title="Tokens">
          <Text>Input: {formatTokens(inputTokens)}</Text>
          <Text>Output: {formatTokens(outputTokens)}</Text>
          <Text>
            Context: {formatTokens(totalTokens)} / {formatTokens(contextWindow)}
          </Text>
          <ContextBar percent={contextPercent} />
        </Section>
      </Card>
    </Pane>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  if (args.trim() === '--settings') {
    return <Settings onClose={onDone} context={context} defaultTab="Status" />
  }
  return <StatusReport />
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsIkxvY2FsSlNYQ29tbWFuZENvbnRleHQiLCJTZXR0aW5ncyIsIkxvY2FsSlNYQ29tbWFuZE9uRG9uZSIsImNhbGwiLCJvbkRvbmUiLCJjb250ZXh0IiwiUHJvbWlzZSIsIlJlYWN0Tm9kZSJdLCJzb3VyY2VzIjpbInN0YXR1cy50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgdHlwZSB7IExvY2FsSlNYQ29tbWFuZENvbnRleHQgfSBmcm9tICcuLi8uLi9jb21tYW5kcy5qcydcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9TZXR0aW5ncy9TZXR0aW5ncy5qcydcbmltcG9ydCB0eXBlIHsgTG9jYWxKU1hDb21tYW5kT25Eb25lIH0gZnJvbSAnLi4vLi4vdHlwZXMvY29tbWFuZC5qcydcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGwoXG4gIG9uRG9uZTogTG9jYWxKU1hDb21tYW5kT25Eb25lLFxuICBjb250ZXh0OiBMb2NhbEpTWENvbW1hbmRDb250ZXh0LFxuKTogUHJvbWlzZTxSZWFjdC5SZWFjdE5vZGU+IHtcbiAgcmV0dXJuIDxTZXR0aW5ncyBvbkNsb3NlPXtvbkRvbmV9IGNvbnRleHQ9e2NvbnRleHR9IGRlZmF1bHRUYWI9XCJTdGF0dXNcIiAvPlxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEtBQUtBLEtBQUssTUFBTSxPQUFPO0FBQzlCLGNBQWNDLHNCQUFzQixRQUFRLG1CQUFtQjtBQUMvRCxTQUFTQyxRQUFRLFFBQVEsdUNBQXVDO0FBQ2hFLGNBQWNDLHFCQUFxQixRQUFRLHdCQUF3QjtBQUVuRSxPQUFPLGVBQWVDLElBQUlBLENBQ3hCQyxNQUFNLEVBQUVGLHFCQUFxQixFQUM3QkcsT0FBTyxFQUFFTCxzQkFBc0IsQ0FDaEMsRUFBRU0sT0FBTyxDQUFDUCxLQUFLLENBQUNRLFNBQVMsQ0FBQyxDQUFDO0VBQzFCLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUNILE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsUUFBUSxHQUFHO0FBQzVFIiwiaWdub3JlTGlzdCI6W119
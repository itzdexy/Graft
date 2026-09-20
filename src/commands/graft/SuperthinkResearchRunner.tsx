import * as React from 'react'
import { useEffect, useRef } from 'react'
import type { Message } from '../../types/message.js'
import { Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type { ToolUseContext } from '../../Tool.js'
import type { CanUseToolFn } from '../../hooks/useCanUseTool.js'
import {
  extractResearchAgentSummary,
  runSuperthinkResearchAgent,
} from '../../services/graft/superthink/researchSubagent.js'
import { loadResearchBrief } from '../../services/graft/superthink/researchStore.js'

type Props = {
  cwd: string
  goal: string
  context: ToolUseContext
  canUseTool?: CanUseToolFn
  onDone: LocalJSXCommandOnDone
}

/** Runs superthink phase-1 research in a background subagent (not the main model). */
export function SuperthinkResearchRunner({
  cwd,
  goal,
  context,
  canUseTool,
  onDone,
}: Props): React.ReactNode {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!canUseTool) {
      onDone('Research subagent unavailable (permissions).', { display: 'system' })
      return
    }

    let cancelled = false
    const messages: Message[] = []

    void (async () => {
      try {
        for await (const msg of runSuperthinkResearchAgent(
          cwd,
          goal,
          context,
          canUseTool,
        )) {
          if (cancelled) return
          messages.push(msg)
        }
        if (cancelled) return

        const summary = extractResearchAgentSummary(messages)
        const brief = loadResearchBrief(cwd, goal)
        const briefNote = brief
          ? 'Research brief saved.'
          : '⚠ Research brief missing — check subagent output and retry `/superthink continue`.'

        onDone(
          [
            '✲ Superthinker: research subagent finished.',
            '',
            briefNote,
            summary ? `\n${summary}` : '',
            '',
            'Opening brainstorm questionnaire…',
          ]
            .filter(Boolean)
            .join('\n'),
          {
            display: 'system',
            nextInput: '/superthink continue',
            submitNextInput: true,
          },
        )
      } catch (err) {
        if (!cancelled) {
          onDone(`Research subagent failed: ${(err as Error).message}`, {
            display: 'system',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canUseTool, context, cwd, goal, onDone])

  return (
    <Text color="suggestion" wrap="wrap">
      ✲ Superthinker: research subagent running (WebSearch/WebFetch → save brief)…
    </Text>
  )
}

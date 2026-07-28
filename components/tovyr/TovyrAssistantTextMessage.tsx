import type { ComponentProps, ReactNode } from 'react'
import {
  extractChatFileDump,
  isLeakedToolDisplayText,
  isModelWriteFailureMessage,
} from '../../services/tovyr/intent/chatDumpExtract.js'
import { tovyrWriteVerifiedOnDisk } from '../../services/tovyr/intent/implementationGuard.js'
import { recoverKeyValueToolCalls } from '../../services/tovyr/openaiCompat/leakedToolSyntax.js'
import {
  filterTovyrAssistantDisplayText,
  isBillingHeaderLeak,
  matchNarratedToolIntent,
  narratedToolOpenCodeLine,
  parsePseudoFunctionToolCall,
  pseudoFunctionOpenCodeLine,
  shouldHideTovyrAssistantText,
} from '../../services/tovyr/dx/chatTextFilter.js'
import { tovyrWritePathVisible } from '../../services/tovyr/dx/tovyrTranscriptCollapse.js'
import { useTovyrTranscript } from './TovyrTranscriptContext.js'
import { getCwd } from '../../utils/cwd.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import { Markdown } from '../Markdown.js'
import { AssistantTextMessage } from '../messages/AssistantTextMessage.js'
import { formatOpenCodeToolLine } from '../../services/tovyr/dx/activityDisplay.js'
import { TovyrCompactToolRow } from './TovyrCompactToolRow.js'
import { TovyrChatTurn } from './TovyrChatTurn.js'
import { TovyrErrorTurn, isTovyrErrorDisplayText } from './TovyrErrorTurn.js'

type Props = ComponentProps<typeof AssistantTextMessage> & {
  /** Normalized assistant message uuid — used to hide duplicate consecutive text rows. */
  messageUuid?: string
}

/** Plain assistant prose with Tovyr turn chrome. */
function TovyrPlainAssistantText({
  text,
  addMargin,
}: {
  text: string
  addMargin: boolean
}): ReactNode {
  const trimmed = text.trim()
  if (!trimmed) return null
  return (
    <TovyrChatTurn role="tovyr" addMargin={addMargin}>
      <Markdown>{trimmed}</Markdown>
    </TovyrChatTurn>
  )
}

/** Hides noise and renders OpenCode-style assistant text in Tovyr. */
export function TovyrAssistantTextMessage(props: Props): ReactNode {
  const { param, shouldShowDot, addMargin, verbose, messageUuid } = props
  const rawText = param.text
  const { visibleWritePaths, hiddenDuplicateAssistantTextUuids } =
    useTovyrTranscript()

  if (
    messageUuid &&
    isTovyrRuntime() &&
    !verbose &&
    hiddenDuplicateAssistantTextUuids.has(messageUuid)
  ) {
    return null
  }

  const suppressPseudoWrite = (filePath: string | undefined): boolean =>
    typeof filePath === 'string' && tovyrWritePathVisible(filePath, visibleWritePaths)

  if (!isTovyrRuntime()) {
    return <AssistantTextMessage {...props} />
  }

  if (verbose) {
    return <AssistantTextMessage {...props} />
  }

  if (isTovyrErrorDisplayText(rawText)) {
    return <TovyrErrorTurn text={rawText} addMargin={addMargin} />
  }

  if (isBillingHeaderLeak(rawText) || shouldHideTovyrAssistantText(rawText)) {
    const pseudo = pseudoFunctionOpenCodeLine(rawText, false)
    if (pseudo) {
      const parsed = parsePseudoFunctionToolCall(rawText)
      const fp =
        typeof parsed?.input?.file_path === 'string'
          ? String(parsed.input.file_path)
          : undefined
      if (suppressPseudoWrite(fp)) return null
      return (
        <TovyrCompactToolRow
          toolName={parsed?.toolName ?? 'Write'}
          input={parsed?.input ?? {}}
          line={pseudo}
          addMargin={addMargin}
        />
      )
    }
    const narrated = narratedToolOpenCodeLine(rawText, false)
    if (narrated) {
      const dump = extractChatFileDump(rawText)
      if (suppressPseudoWrite(dump?.filePath)) return null
      return (
        <TovyrCompactToolRow
          toolName="Write"
          input={{}}
          line={narrated}
          addMargin={addMargin}
        />
      )
    }
    return null
  }

  if (isModelWriteFailureMessage(rawText)) {
    const dump = extractChatFileDump(rawText)
    // Pure "Write unavailable" prose; the pseudo Write row already covers it.
    if (!dump) return null
    if (suppressPseudoWrite(dump.filePath)) return null
    const onDisk = tovyrWriteVerifiedOnDisk(dump.filePath, getCwd())
    const line = formatOpenCodeToolLine(
      'Write',
      { file_path: dump.filePath },
      { inProgress: !onDisk, ok: onDisk },
    )
    return (
      <TovyrCompactToolRow
        toolName="Write"
        input={{ file_path: dump.filePath }}
        line={line}
        addMargin={addMargin}
      />
    )
  }

  if (isLeakedToolDisplayText(rawText)) {
    const dump = extractChatFileDump(rawText)
    const kv = recoverKeyValueToolCalls(rawText)
    const writePath =
      dump?.filePath ??
      (typeof kv.toolUses[0]?.input?.file_path === 'string'
        ? String(kv.toolUses[0].input.file_path).split(/[/\\]/).pop() ?? 'file'
        : 'file')
    if (suppressPseudoWrite(writePath)) return null
    const onDisk =
      dump !== null && tovyrWriteVerifiedOnDisk(dump.filePath, getCwd())
    const line = narratedToolOpenCodeLine(rawText, !onDisk)
    if (line) {
      return (
        <TovyrCompactToolRow
          toolName="Write"
          input={kv.toolUses[0]?.input ?? { file_path: writePath }}
          line={line}
          addMargin={addMargin}
        />
      )
    }
    return (
      <TovyrCompactToolRow
        toolName="Write"
        input={{ file_path: writePath }}
        ok={onDisk}
        addMargin={addMargin}
      />
    )
  }

  const narrated = matchNarratedToolIntent(rawText)
  if (narrated) {
    const line = narratedToolOpenCodeLine(rawText, false)
    if (line) {
      return (
        <TovyrCompactToolRow
          toolName={narrated.toolName}
          input={{}}
          line={line}
          addMargin={addMargin}
        />
      )
    }
  }

  const displayText = filterTovyrAssistantDisplayText(rawText)
  if (!displayText) return null

  return <TovyrPlainAssistantText addMargin={addMargin} text={displayText} />
}

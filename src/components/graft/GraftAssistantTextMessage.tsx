import type { ComponentProps, ReactNode } from 'react'
import {
  extractChatFileDump,
  isLeakedToolDisplayText,
  isModelWriteFailureMessage,
} from '../../services/graft/intent/chatDumpExtract.js'
import { graftWriteVerifiedOnDisk } from '../../services/graft/intent/implementationGuard.js'
import { recoverKeyValueToolCalls } from '../../services/graft/openaiCompat/leakedToolSyntax.js'
import {
  filterGraftAssistantDisplayText,
  isBillingHeaderLeak,
  jsonToolCallLeakOpenCodeLine,
  matchNarratedToolIntent,
  narratedToolOpenCodeLine,
  parseJsonToolCallLeak,
  parsePseudoFunctionToolCall,
  pseudoFunctionOpenCodeLine,
  shouldHideGraftAssistantText,
} from '../../services/graft/dx/chatTextFilter.js'
import { graftWritePathVisible } from '../../services/graft/dx/graftTranscriptCollapse.js'
import { useGraftTranscript } from './GraftTranscriptContext.js'
import { getCwd } from '../../utils/cwd.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'
import { Markdown } from '../Markdown.js'
import { AssistantTextMessage } from '../messages/AssistantTextMessage.js'
import { formatOpenCodeToolLine } from '../../services/graft/dx/activityDisplay.js'
import { GraftCompactToolRow } from './GraftCompactToolRow.js'
import { GraftChatTurn } from './GraftChatTurn.js'
import { GraftErrorTurn, isGraftErrorDisplayText } from './GraftErrorTurn.js'

type Props = ComponentProps<typeof AssistantTextMessage> & {
  /** Normalized assistant message uuid — used to hide duplicate consecutive text rows. */
  messageUuid?: string
}

/** Plain assistant prose with Graft turn chrome. */
function GraftPlainAssistantText({
  text,
  addMargin,
}: {
  text: string
  addMargin: boolean
}): ReactNode {
  const trimmed = text.trim()
  if (!trimmed) return null
  return (
    <GraftChatTurn role="graft" addMargin={addMargin}>
      <Markdown>{trimmed}</Markdown>
    </GraftChatTurn>
  )
}

/** Hides noise and renders OpenCode-style assistant text in Graft. */
export function GraftAssistantTextMessage(props: Props): ReactNode {
  const { param, shouldShowDot, addMargin, verbose, messageUuid } = props
  const rawText = param.text
  const { visibleWritePaths, hiddenDuplicateAssistantTextUuids } =
    useGraftTranscript()

  if (
    messageUuid &&
    isGraftRuntime() &&
    !verbose &&
    hiddenDuplicateAssistantTextUuids.has(messageUuid)
  ) {
    return null
  }

  const suppressPseudoWrite = (filePath: string | undefined): boolean =>
    typeof filePath === 'string' && graftWritePathVisible(filePath, visibleWritePaths)

  if (!isGraftRuntime()) {
    return <AssistantTextMessage {...props} />
  }

  if (verbose) {
    return <AssistantTextMessage {...props} />
  }

  if (isGraftErrorDisplayText(rawText)) {
    return <GraftErrorTurn text={rawText} addMargin={addMargin} />
  }

  // A tool call the model spoke instead of calling. Show the tool row it meant,
  // never the raw JSON — the converter already recovered and ran the real call.
  const jsonLeak = jsonToolCallLeakOpenCodeLine(rawText, false)
  if (jsonLeak) {
    const parsed = parseJsonToolCallLeak(rawText)
    return (
      <>
        {parsed?.prose ? (
          <GraftPlainAssistantText addMargin={addMargin} text={parsed.prose} />
        ) : null}
        <GraftCompactToolRow
          toolName={parsed?.toolName ?? 'Tool'}
          input={parsed?.input ?? {}}
          line={jsonLeak}
          addMargin={addMargin && !parsed?.prose}
        />
      </>
    )
  }

  if (isBillingHeaderLeak(rawText) || shouldHideGraftAssistantText(rawText)) {
    const pseudo = pseudoFunctionOpenCodeLine(rawText, false)
    if (pseudo) {
      const parsed = parsePseudoFunctionToolCall(rawText)
      const fp =
        typeof parsed?.input?.file_path === 'string'
          ? String(parsed.input.file_path)
          : undefined
      if (suppressPseudoWrite(fp)) return null
      return (
        <GraftCompactToolRow
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
        <GraftCompactToolRow
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
    const onDisk = graftWriteVerifiedOnDisk(dump.filePath, getCwd())
    const line = formatOpenCodeToolLine(
      'Write',
      { file_path: dump.filePath },
      { inProgress: !onDisk, ok: onDisk },
    )
    return (
      <GraftCompactToolRow
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
      dump !== null && graftWriteVerifiedOnDisk(dump.filePath, getCwd())
    const line = narratedToolOpenCodeLine(rawText, !onDisk)
    if (line) {
      return (
        <GraftCompactToolRow
          toolName="Write"
          input={kv.toolUses[0]?.input ?? { file_path: writePath }}
          line={line}
          addMargin={addMargin}
        />
      )
    }
    return (
      <GraftCompactToolRow
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
        <GraftCompactToolRow
          toolName={narrated.toolName}
          input={{}}
          line={line}
          addMargin={addMargin}
        />
      )
    }
  }

  const displayText = filterGraftAssistantDisplayText(rawText)
  if (!displayText) return null

  return <GraftPlainAssistantText addMargin={addMargin} text={displayText} />
}

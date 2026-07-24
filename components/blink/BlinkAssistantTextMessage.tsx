import type { ComponentProps, ReactNode } from 'react'
import {
  extractChatFileDump,
  isLeakedToolDisplayText,
  isModelWriteFailureMessage,
} from '../../services/blink/intent/chatDumpExtract.js'
import { blinkWriteVerifiedOnDisk } from '../../services/blink/intent/implementationGuard.js'
import { recoverKeyValueToolCalls } from '../../services/blink/openaiCompat/leakedToolSyntax.js'
import {
  filterBlinkAssistantDisplayText,
  isBillingHeaderLeak,
  matchNarratedToolIntent,
  narratedToolOpenCodeLine,
  parsePseudoFunctionToolCall,
  pseudoFunctionOpenCodeLine,
  shouldHideBlinkAssistantText,
} from '../../services/blink/dx/chatTextFilter.js'
import { blinkWritePathVisible } from '../../services/blink/dx/blinkTranscriptCollapse.js'
import { useBlinkTranscript } from './BlinkTranscriptContext.js'
import { getCwd } from '../../utils/cwd.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { Markdown } from '../Markdown.js'
import { AssistantTextMessage } from '../messages/AssistantTextMessage.js'
import { formatOpenCodeToolLine } from '../../services/blink/dx/activityDisplay.js'
import { BlinkCompactToolRow } from './BlinkCompactToolRow.js'
import { BlinkChatTurn } from './BlinkChatTurn.js'
import { BlinkErrorTurn, isBlinkErrorDisplayText } from './BlinkErrorTurn.js'

type Props = ComponentProps<typeof AssistantTextMessage> & {
  /** Normalized assistant message uuid — used to hide duplicate consecutive text rows. */
  messageUuid?: string
}

/** Plain assistant prose with Blink turn chrome. */
function BlinkPlainAssistantText({
  text,
  addMargin,
}: {
  text: string
  addMargin: boolean
}): ReactNode {
  const trimmed = text.trim()
  if (!trimmed) return null
  return (
    <BlinkChatTurn role="blink" addMargin={addMargin}>
      <Markdown>{trimmed}</Markdown>
    </BlinkChatTurn>
  )
}

/** Hides noise and renders OpenCode-style assistant text in Blink. */
export function BlinkAssistantTextMessage(props: Props): ReactNode {
  const { param, shouldShowDot, addMargin, verbose, messageUuid } = props
  const rawText = param.text
  const { visibleWritePaths, hiddenDuplicateAssistantTextUuids } =
    useBlinkTranscript()

  if (
    messageUuid &&
    isBlinkRuntime() &&
    !verbose &&
    hiddenDuplicateAssistantTextUuids.has(messageUuid)
  ) {
    return null
  }

  const suppressPseudoWrite = (filePath: string | undefined): boolean =>
    typeof filePath === 'string' && blinkWritePathVisible(filePath, visibleWritePaths)

  if (!isBlinkRuntime()) {
    return <AssistantTextMessage {...props} />
  }

  if (verbose) {
    return <AssistantTextMessage {...props} />
  }

  if (isBlinkErrorDisplayText(rawText)) {
    return <BlinkErrorTurn text={rawText} addMargin={addMargin} />
  }

  if (isBillingHeaderLeak(rawText) || shouldHideBlinkAssistantText(rawText)) {
    const pseudo = pseudoFunctionOpenCodeLine(rawText, false)
    if (pseudo) {
      const parsed = parsePseudoFunctionToolCall(rawText)
      const fp =
        typeof parsed?.input?.file_path === 'string'
          ? String(parsed.input.file_path)
          : undefined
      if (suppressPseudoWrite(fp)) return null
      return (
        <BlinkCompactToolRow
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
        <BlinkCompactToolRow
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
    const onDisk = blinkWriteVerifiedOnDisk(dump.filePath, getCwd())
    const line = formatOpenCodeToolLine(
      'Write',
      { file_path: dump.filePath },
      { inProgress: !onDisk, ok: onDisk },
    )
    return (
      <BlinkCompactToolRow
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
      dump !== null && blinkWriteVerifiedOnDisk(dump.filePath, getCwd())
    const line = narratedToolOpenCodeLine(rawText, !onDisk)
    if (line) {
      return (
        <BlinkCompactToolRow
          toolName="Write"
          input={kv.toolUses[0]?.input ?? { file_path: writePath }}
          line={line}
          addMargin={addMargin}
        />
      )
    }
    return (
      <BlinkCompactToolRow
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
        <BlinkCompactToolRow
          toolName={narrated.toolName}
          input={{}}
          line={line}
          addMargin={addMargin}
        />
      )
    }
  }

  const displayText = filterBlinkAssistantDisplayText(rawText)
  if (!displayText) return null

  return <BlinkPlainAssistantText addMargin={addMargin} text={displayText} />
}

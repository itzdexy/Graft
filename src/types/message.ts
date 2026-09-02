// Central message types for the Tovyr conversation pipeline.
//
// This module is the single source of truth for everything that flows through
// query(), normalizeMessages(), the transcript store, and the REPL renderer.
// It is intentionally type-only: importing it never emits runtime code.
import type { UUID } from 'crypto'
import type { APIError } from '@anthropic-ai/sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type {
  BetaContentBlock,
  BetaMessage,
  BetaRawMessageStreamEvent,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { SDKAssistantMessageError } from '../entrypoints/agentSdkTypes.js'
import type { Attachment } from '../utils/attachments.js'
import type { HookProgress } from './hooks.js'
import type { ToolProgressData } from './tools.js'
import type { PermissionMode } from './permissions.js'

/** Anything that can stream progress for a tool or hook. */
export type Progress = ToolProgressData | HookProgress

/** Severity of informational system messages. */
export type SystemMessageLevel = 'info' | 'warning' | 'error' | 'suggestion'

/** Direction of a partial (mid-conversation) compaction. */
export type PartialCompactDirection = 'from' | 'up_to'

/** Where a message came from. `human` is the default for typed user input. */
export type MessageOrigin =
  | { kind: 'human' }
  | { kind: 'task-notification' }
  | { kind: 'coordinator' }
  | { kind: 'channel'; server: string }

// ---------------------------------------------------------------------------
// User messages
// ---------------------------------------------------------------------------

export type UserMessage = {
  type: 'user'
  message: {
    role: 'user'
    content: string | Array<ContentBlockParam>
  }
  uuid: UUID
  timestamp: string
  /** true = hidden from UI, still sent to the model. */
  isMeta?: true
  /** Rendered in transcript exports only, not sent to the API. */
  isVisibleInTranscriptOnly?: true
  /** Display-only; stripped before any API request. */
  isVirtual?: true
  /** Marks the post-compact summary user turn. */
  isCompactSummary?: true
  summarizeMetadata?: {
    messagesSummarized: number
    userContext?: string
    direction?: PartialCompactDirection
  }
  /** Full tool Output object attached to a tool_result user message. */
  toolUseResult?: unknown
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
  imagePasteIds?: number[]
  /** uuid of the assistant message containing the matching tool_use block. */
  sourceToolAssistantUUID?: UUID
  permissionMode?: PermissionMode
  origin?: MessageOrigin
  /** Attached by /plan flows. */
  planContent?: string
  /** Attached when tagging queued input with originating tool use. */
  sourceToolUseID?: string
}

// ---------------------------------------------------------------------------
// Assistant messages
// ---------------------------------------------------------------------------

export type AssistantMessage = {
  type: 'assistant'
  uuid: UUID
  timestamp: string
  message: BetaMessage
  requestId?: string
  /** Set when the response was truncated by the output token limit. */
  apiError?: string
  /** Structured SDK-level failure classification. */
  error?: SDKAssistantMessageError
  /** Raw provider error text, surfaced verbatim in the UI. */
  errorDetails?: string
  isApiErrorMessage?: boolean
  isVirtual?: true
  isMeta?: true
  /** Advisor model that produced this message, when one was used. */
  advisorModel?: string
}

/**
 * Assistant message after normalization: content is split so each message
 * carries exactly one content block.
 */
export type NormalizedAssistantMessage<
  T extends BetaContentBlock = BetaContentBlock,
> = Omit<AssistantMessage, 'message'> & {
  message: Omit<BetaMessage, 'content'> & {
    content: [T] | Array<T>
  }
}

/** User message after normalization: content is always an array of blocks. */
export type NormalizedUserMessage = Omit<UserMessage, 'message'> & {
  message: {
    role: 'user'
    content: Array<ContentBlockParam>
  }
}

// ---------------------------------------------------------------------------
// Streaming control envelopes (never persisted)
// ---------------------------------------------------------------------------

export type StreamEvent = {
  type: 'stream_event'
  event: BetaRawMessageStreamEvent
  /** Time-to-first-token for this request, present on message_start only. */
  ttftMs?: number
}

export type RequestStartEvent = {
  type: 'stream_request_start'
}

/** Removes the wrapped message from the live transcript. */
export type TombstoneMessage = {
  type: 'tombstone'
  message: Message
}

// ---------------------------------------------------------------------------
// Progress + attachments
// ---------------------------------------------------------------------------

export type ProgressMessage<P extends Progress = Progress> = {
  type: 'progress'
  data: P
  toolUseID: string
  parentToolUseID: string
  uuid: UUID
  timestamp: string
}

export type AttachmentMessage<T extends Attachment = Attachment> = {
  type: 'attachment'
  attachment: T
  uuid: UUID
  timestamp: string
}

/** Messages produced by hook execution results. */
export type HookResultMessage =
  | AttachmentMessage
  | ProgressMessage<HookProgress>

/** One executed stop hook, summarized in stop_hook_summary messages. */
export type StopHookInfo = {
  command: string
  promptText?: string
  durationMs?: number
}

// ---------------------------------------------------------------------------
// Compaction metadata
// ---------------------------------------------------------------------------

export type CompactMetadata = {
  trigger: 'manual' | 'auto'
  preTokens: number
  userContext?: string
  messagesSummarized?: number
  preservedSegment?: {
    headUuid: string
    anchorUuid: string
    tailUuid: string
  }
  /** Tool names discovered before compaction, re-injected after. */
  preCompactDiscoveredTools?: string[]
}

export type SystemCompactBoundaryMessage = {
  type: 'system'
  subtype: 'compact_boundary'
  content: string
  level: SystemMessageLevel
  isMeta?: boolean
  compactMetadata?: CompactMetadata
  logicalParentUuid?: UUID
  timestamp: string
  uuid: UUID
}

export type SystemMicrocompactBoundaryMessage = {
  type: 'system'
  subtype: 'microcompact_boundary'
  content: string
  level: SystemMessageLevel
  isMeta?: boolean
  microcompactMetadata: {
    trigger: 'auto'
    preTokens: number
    tokensSaved: number
    compactedToolIds: string[]
    clearedAttachmentUUIDs: string[]
  }
  timestamp: string
  uuid: UUID
}

// ---------------------------------------------------------------------------
// System messages
// ---------------------------------------------------------------------------

export type SystemInformationalMessage = {
  type: 'system'
  subtype: 'informational'
  content: string
  level: SystemMessageLevel
  isMeta?: boolean
  timestamp: string
  uuid: UUID
  toolUseID?: string
  preventContinuation?: boolean
}

export type SystemLocalCommandMessage = {
  type: 'system'
  subtype: 'local_command'
  content: string
  level: SystemMessageLevel
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemAPIErrorMessage = {
  type: 'system'
  subtype: 'api_error'
  level: 'error'
  error: APIError
  cause?: Error
  retryInMs: number
  retryAttempt: number
  maxRetries: number
  timestamp: string
  uuid: UUID
}

export type SystemPermissionRetryMessage = {
  type: 'system'
  subtype: 'permission_retry'
  content: string
  commands: string[]
  level: SystemMessageLevel
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemBridgeStatusMessage = {
  type: 'system'
  subtype: 'bridge_status'
  content: string
  url: string
  upgradeNudge?: string
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemScheduledTaskFireMessage = {
  type: 'system'
  subtype: 'scheduled_task_fire'
  content: string
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemStopHookSummaryMessage = {
  type: 'system'
  subtype: 'stop_hook_summary'
  hookCount: number
  hookInfos: StopHookInfo[]
  hookErrors: string[]
  preventedContinuation: boolean
  stopReason: string | undefined
  hasOutput: boolean
  level: SystemMessageLevel
  toolUseID?: string
  hookLabel?: string
  totalDurationMs?: number
  timestamp: string
  uuid: UUID
}

export type SystemTurnDurationMessage = {
  type: 'system'
  subtype: 'turn_duration'
  durationMs: number
  budgetTokens?: number
  budgetLimit?: number
  budgetNudges?: number
  messageCount?: number
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemAwaySummaryMessage = {
  type: 'system'
  subtype: 'away_summary'
  content: string
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemMemorySavedMessage = {
  type: 'system'
  subtype: 'memory_saved'
  writtenPaths: string[]
  /** Number of shared-team memories, when team memory is enabled. */
  teamCount?: number
  verb?: string
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemAgentsKilledMessage = {
  type: 'system'
  subtype: 'agents_killed'
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemApiMetricsMessage = {
  type: 'system'
  subtype: 'api_metrics'
  ttftMs: number
  otps: number
  isP50?: boolean
  hookDurationMs?: number
  turnDurationMs?: number
  toolDurationMs?: number
  classifierDurationMs?: number
  toolCount?: number
  hookCount?: number
  classifierCount?: number
  configWriteCount?: number
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemThinkingMessage = {
  type: 'system'
  subtype: 'thinking'
  content: string
  level?: SystemMessageLevel
  isMeta?: boolean
  timestamp: string
  uuid: UUID
}

export type SystemFileSnapshotMessage = {
  type: 'system'
  subtype: 'file_snapshot'
  content: string
  level: SystemMessageLevel
  isMeta: boolean
  snapshotFiles: Array<{ key: string; path: string; content: string }>
  timestamp: string
  uuid: UUID
}

/** Human-readable summary emitted after a batch of tool calls completes. */
export type ToolUseSummaryMessage = {
  type: 'tool_use_summary'
  summary: string
  precedingToolUseIds: string[]
  timestamp: string
  uuid: UUID
}

export type SystemMessage =
  | SystemInformationalMessage
  | SystemLocalCommandMessage
  | SystemAPIErrorMessage
  | SystemCompactBoundaryMessage
  | SystemMicrocompactBoundaryMessage
  | SystemPermissionRetryMessage
  | SystemBridgeStatusMessage
  | SystemStopHookSummaryMessage
  | SystemTurnDurationMessage
  | SystemAwaySummaryMessage
  | SystemMemorySavedMessage
  | SystemAgentsKilledMessage
  | SystemApiMetricsMessage
  | SystemScheduledTaskFireMessage
  | SystemThinkingMessage
  | SystemFileSnapshotMessage

// ---------------------------------------------------------------------------
// Unions
// ---------------------------------------------------------------------------

export type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | ProgressMessage
  | AttachmentMessage

export type NormalizedMessage =
  | NormalizedUserMessage
  | NormalizedAssistantMessage
  | SystemMessage
  | ProgressMessage
  | AttachmentMessage

// ---------------------------------------------------------------------------
// UI grouping (render-only; never sent to the API)
// ---------------------------------------------------------------------------

export type GroupedToolUseMessage = {
  type: 'grouped_tool_use'
  toolName: string
  messageId: string
  messages: NormalizedAssistantMessage<BetaToolUseBlock>[]
  results: NormalizedUserMessage[]
  displayMessage: NormalizedAssistantMessage<BetaToolUseBlock>
  uuid: string
  timestamp: string
}

export type CollapsibleMessage =
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | GroupedToolUseMessage

export type CollapsedReadSearchGroup = {
  type: 'collapsed_read_search'
  searchCount: number
  readCount: number
  listCount: number
  replCount: number
  memorySearchCount: number
  memoryReadCount: number
  memoryWriteCount: number
  teamMemorySearchCount?: number
  teamMemoryReadCount?: number
  teamMemoryWriteCount?: number
  readFilePaths: string[]
  searchArgs: string[]
  latestDisplayHint: string | undefined
  messages: CollapsibleMessage[]
  displayMessage: Exclude<CollapsibleMessage, { type: 'grouped_tool_use' }>
  uuid: UUID
  timestamp: string
  mcpCallCount?: number
  mcpServerNames?: string[]
  bashCount?: number
  gitOpBashCount?: number
  commits?: { sha: string; kind: string }[]
  pushes?: { branch: string }[]
  branches?: { ref: string; action: string }[]
  prs?: { number: number; url?: string; action: string }[]
  hookTotalMs?: number
  hookCount?: number
  hookInfos?: StopHookInfo[]
  relevantMemories?: { path: string; content: string; mtimeMs: number }[]
}

/** Everything the renderer can display. */
export type RenderableMessage =
  | Exclude<NormalizedMessage, ProgressMessage>
  | GroupedToolUseMessage
  | CollapsedReadSearchGroup

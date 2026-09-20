import { feature } from '../utils/features.js'
import * as React from 'react'
import { memo, useCallback, useEffect, useRef } from 'react'
import { logEvent } from 'src/services/analytics/index.js'
import { useAppState, useSetAppState } from 'src/state/AppState.js'
import type { AppState } from 'src/state/AppStateStore.js'
import type { PermissionMode } from 'src/utils/permissions/PermissionMode.js'
import {
  getIsRemoteMode,
  getGraftsActive,
  getMainThreadAgentType,
  getOriginalCwd,
  getSdkBetas,
  getSessionId,
} from '../bootstrap/state.js'
import { DEFAULT_OUTPUT_STYLE_NAME } from '../constants/outputStyles.js'
import { useNotifications } from '../context/notifications.js'
import {
  getTotalAPIDuration,
  getTotalCost,
  getTotalDuration,
  getTotalInputTokens,
  getTotalLinesAdded,
  getTotalLinesRemoved,
  getTotalOutputTokens,
} from '../cost-tracker.js'
import { useMainLoopModel } from '../hooks/useMainLoopModel.js'
import { type ReadonlySettings, useSettings } from '../hooks/useSettings.js'
import { Ansi, Box, Text } from '../ink.js'
import { getRawUtilization } from '../services/graftWebLimits.js'
import type { Message } from '../types/message.js'
import type { StatusLineCommandInput } from '../types/statusLine.js'
import type { VimMode } from '../types/textInputTypes.js'
import { checkHasTrustDialogAccepted } from '../utils/config.js'
import {
  calculateContextPercentages,
  getContextWindowForModel,
} from '../utils/context.js'
import { getCwd } from '../utils/cwd.js'
import {
  getModeColor,
  permissionModeShortTitle,
  permissionModeSymbol,
} from '../utils/permissions/PermissionMode.js'
import { logForDebugging } from '../utils/debug.js'
import { isFullscreenEnvEnabled } from '../utils/fullscreen.js'
import {
  createBaseHookInput,
  executeStatusLineCommand,
} from '../utils/hooks.js'
import { getLastAssistantMessage } from '../utils/messages.js'
import {
  getRuntimeMainLoopModel,
  type ModelName,
  renderModelName,
} from '../utils/model/model.js'
import { getCurrentSessionTitle } from '../utils/sessionStorage.js'
import {
  doesMostRecentAssistantMessageExceed200k,
  getCurrentUsage,
} from '../utils/tokens.js'
import { getCurrentWorktreeSession } from '../utils/worktree.js'
import { isVimModeEnabled } from './PromptInput/utils.js'
import { isGraftRuntime } from '../utils/graftRuntime.js'

declare const MACRO: { VERSION: string }

export function statusLineShouldDisplay(settings: ReadonlySettings): boolean {
  // Assistant mode: statusline fields reflect the REPL/daemon process, not the
  // agent child. Hide it there; everywhere else, show our default or configured
  // status line.
  if (feature('GRAFTS') && getGraftsActive()) return false
  if (isGraftRuntime() && !settings?.statusLine?.command) return false
  return true
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatCost(n: number): string {
  return n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function contextBar(percent: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function DefaultStatusLine(): React.ReactNode {
  if (isGraftRuntime()) return null
  const cwd = getCwd()
  const originalCwd = getOriginalCwd()
  const projectName =
    cwd.replace(originalCwd, '').replace(/^[/\\]/, '') || originalCwd
  const mainLoopModel = useMainLoopModel()
  const permissionMode = useAppState((s: AppState) => s.toolPermissionContext.mode)
  const modeColor = getModeColor(permissionMode)
  const modeLabel = permissionModeShortTitle(permissionMode)
  const modeSymbol = permissionModeSymbol(permissionMode)

  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      <Text bold color="graftPrimary" wrap="truncate-start">
        Graft
      </Text>
      <Text color="inactive" dimColor>
        │
      </Text>
      <Text color="subtle" wrap="truncate-start">
        {projectName || 'Graft'}
      </Text>
      <Text color="inactive" dimColor>
        │
      </Text>
      <Text color="inactive" dimColor wrap="truncate-start">
        {renderModelName(mainLoopModel)}
      </Text>
      <Text color="inactive" dimColor>
        │
      </Text>
      <Text bold color={modeColor} wrap="truncate-start">
        {modeSymbol ? `${modeSymbol} ` : ''}
        {modeLabel}
      </Text>
      <Text color="inactive" dimColor>
        │
      </Text>
      <Text color="inactive" dimColor>
        v{MACRO.VERSION}
      </Text>
    </Box>
  )
}

function buildStatusLineCommandInput(
  permissionMode: PermissionMode,
  exceeds200kTokens: boolean,
  settings: ReadonlySettings,
  messages: Message[],
  addedDirs: string[],
  mainLoopModel: ModelName,
  vimMode?: VimMode,
): StatusLineCommandInput {
  const agentType = getMainThreadAgentType()
  const worktreeSession = getCurrentWorktreeSession()
  const runtimeModel = getRuntimeMainLoopModel({
    permissionMode,
    mainLoopModel,
    exceeds200kTokens,
  })
  const outputStyleName = settings?.outputStyle || DEFAULT_OUTPUT_STYLE_NAME

  const currentUsage = getCurrentUsage(messages)
  const contextWindowSize = getContextWindowForModel(runtimeModel, getSdkBetas())
  const contextPercentages = calculateContextPercentages(
    currentUsage,
    contextWindowSize,
  )

  const sessionId = getSessionId()
  const sessionName = getCurrentSessionTitle(sessionId)
  const rawUtil = getRawUtilization()
  const rateLimits: StatusLineCommandInput['rate_limits'] = {
    ...(rawUtil.five_hour && {
      five_hour: {
        used_percentage: rawUtil.five_hour.utilization * 100,
        resets_at: rawUtil.five_hour.resets_at,
      },
    }),
    ...(rawUtil.seven_day && {
      seven_day: {
        used_percentage: rawUtil.seven_day.utilization * 100,
        resets_at: rawUtil.seven_day.resets_at,
      },
    }),
  }
  return {
    ...createBaseHookInput(),
    ...(sessionName && { session_name: sessionName }),
    model: {
      id: runtimeModel,
      display_name: renderModelName(runtimeModel),
    },
    workspace: {
      current_dir: getCwd(),
      project_dir: getOriginalCwd(),
      added_dirs: addedDirs,
    },
    version: MACRO.VERSION,
    output_style: {
      name: outputStyleName,
    },
    cost: {
      total_cost_usd: getTotalCost(),
      total_duration_ms: getTotalDuration(),
      total_api_duration_ms: getTotalAPIDuration(),
      total_lines_added: getTotalLinesAdded(),
      total_lines_removed: getTotalLinesRemoved(),
    },
    context_window: {
      total_input_tokens: getTotalInputTokens(),
      total_output_tokens: getTotalOutputTokens(),
      context_window_size: contextWindowSize,
      current_usage: currentUsage,
      used_percentage: contextPercentages.used,
      remaining_percentage: contextPercentages.remaining,
    },
    exceeds_200k_tokens: exceeds200kTokens,
    ...((rateLimits.five_hour || rateLimits.seven_day) && {
      rate_limits: rateLimits,
    }),
    ...(isVimModeEnabled() && {
      vim: {
        mode: vimMode ?? 'INSERT',
      },
    }),
    ...(agentType && {
      agent: {
        name: agentType,
      },
    }),
    ...(getIsRemoteMode() && {
      remote: {
        session_id: getSessionId(),
      },
    }),
    ...(worktreeSession && {
      worktree: {
        name: worktreeSession.worktreeName,
        path: worktreeSession.worktreePath,
        branch: worktreeSession.worktreeBranch,
        original_cwd: worktreeSession.originalCwd,
        original_branch: worktreeSession.originalBranch,
      },
    }),
  }
}

type Props = {
  // messages stays behind a ref (read only in the debounced callback);
  // lastAssistantMessageId is the actual re-render trigger.
  messagesRef: React.RefObject<Message[]>
  lastAssistantMessageId: string | null
  vimMode?: VimMode
}

export function getLastAssistantMessageId(messages: Message[]): string | null {
  return getLastAssistantMessage(messages)?.uuid ?? null
}

function StatusLineInner({
  messagesRef,
  lastAssistantMessageId,
  vimMode,
}: Props): React.ReactNode {
  const abortControllerRef = useRef<AbortController | undefined>(undefined)
  const permissionMode = useAppState((s: AppState) => s.toolPermissionContext.mode)
  const additionalWorkingDirectories = useAppState(
    (s: AppState) => s.toolPermissionContext.additionalWorkingDirectories,
  )
  const statusLineText = useAppState((s: AppState) => s.statusLineText)
  const setAppState = useSetAppState()
  const settings = useSettings()
  const { addNotification } = useNotifications()
  const mainLoopModel = useMainLoopModel()

  // Keep latest values in refs for stable callback access
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const vimModeRef = useRef(vimMode)
  vimModeRef.current = vimMode
  const permissionModeRef = useRef(permissionMode)
  permissionModeRef.current = permissionMode
  const addedDirsRef = useRef(additionalWorkingDirectories)
  addedDirsRef.current = additionalWorkingDirectories
  const mainLoopModelRef = useRef(mainLoopModel)
  mainLoopModelRef.current = mainLoopModel

  // Track previous state to detect changes and cache expensive calculations
  const previousStateRef = useRef<{
    messageId: string | null
    exceeds200kTokens: boolean
    permissionMode: PermissionMode
    vimMode: VimMode | undefined
    mainLoopModel: ModelName
  }>({
    messageId: null,
    exceeds200kTokens: false,
    permissionMode,
    vimMode,
    mainLoopModel,
  })

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  // True when the next invocation should log its result (first run or after settings reload)
  const logNextResultRef = useRef(true)

  // Stable update function — reads latest values from refs
  const doUpdate = useCallback(async () => {
    // Cancel any in-flight requests
    abortControllerRef.current?.abort()

    const controller = new AbortController()
    abortControllerRef.current = controller

    const msgs = messagesRef.current

    const logResult = logNextResultRef.current
    logNextResultRef.current = false

    try {
      let exceeds200kTokens = previousStateRef.current.exceeds200kTokens

      // Only recalculate 200k check if messages changed
      const currentMessageId = getLastAssistantMessageId(msgs)
      if (currentMessageId !== previousStateRef.current.messageId) {
        exceeds200kTokens = doesMostRecentAssistantMessageExceed200k(msgs)
        previousStateRef.current.messageId = currentMessageId
        previousStateRef.current.exceeds200kTokens = exceeds200kTokens
      }

      const statusInput = buildStatusLineCommandInput(
        permissionModeRef.current,
        exceeds200kTokens,
        settingsRef.current,
        msgs,
        Array.from(addedDirsRef.current.keys()),
        mainLoopModelRef.current,
        vimModeRef.current,
      )

      const text = await executeStatusLineCommand(
        statusInput,
        controller.signal,
        undefined,
        logResult,
      )
      if (!controller.signal.aborted) {
        setAppState(prev => {
          if (prev.statusLineText === text) return prev
          return { ...prev, statusLineText: text }
        })
      }
    } catch {
      // Silently ignore errors in status line updates
    }
  }, [messagesRef, setAppState])

  // Stable debounced schedule function — no deps, uses refs
  const scheduleUpdate = useCallback(() => {
    if (debounceTimerRef.current !== undefined) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(
      (ref, doUpdate) => {
        ref.current = undefined
        void doUpdate()
      },
      300,
      debounceTimerRef,
      doUpdate,
    )
  }, [doUpdate])

  // Only trigger update when assistant message, permission mode, vim mode, or model actually changes
  useEffect(() => {
    if (
      lastAssistantMessageId !== previousStateRef.current.messageId ||
      permissionMode !== previousStateRef.current.permissionMode ||
      vimMode !== previousStateRef.current.vimMode ||
      mainLoopModel !== previousStateRef.current.mainLoopModel
    ) {
      // Don't update messageId here — let doUpdate handle it so
      // exceeds200kTokens is recalculated with the latest messages
      previousStateRef.current.permissionMode = permissionMode
      previousStateRef.current.vimMode = vimMode
      previousStateRef.current.mainLoopModel = mainLoopModel
      scheduleUpdate()
    }
  }, [
    lastAssistantMessageId,
    permissionMode,
    vimMode,
    mainLoopModel,
    scheduleUpdate,
  ])

  // When the statusLine command changes (hot reload), log the next result
  const statusLineCommand = settings?.statusLine?.command
  const isFirstSettingsRender = useRef(true)
  useEffect(() => {
    if (isFirstSettingsRender.current) {
      isFirstSettingsRender.current = false
      return
    }
    logNextResultRef.current = true
    void doUpdate()
  }, [statusLineCommand, doUpdate])

  // Separate effect for logging on mount
  useEffect(() => {
    const statusLine = settings?.statusLine
    if (statusLine) {
      logEvent('tengu_status_line_mount', {
        command_length: statusLine.command.length,
        padding: statusLine.padding,
      })
      // Log if status line is configured but disabled by disableAllHooks
      if (settings.disableAllHooks === true) {
        logForDebugging(
          'Status line is configured but disableAllHooks is true',
          { level: 'warn' },
        )
      }
      // executeStatusLineCommand (hooks.ts) returns undefined when trust is
      // blocked — statusLineText stays undefined forever, user sees nothing,
      // and tengu_status_line_mount above fires anyway so telemetry looks fine.
      if (!checkHasTrustDialogAccepted()) {
        addNotification({
          key: 'statusline-trust-blocked',
          text: 'statusline skipped · restart to fix',
          color: 'warning',
          priority: 'low',
        })
        logForDebugging(
          'Status line command skipped: workspace trust not accepted',
          { level: 'warn' },
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  }, []) // Only run once on mount - settings stable for initial logging

  // Initial update on mount + cleanup on unmount
  useEffect(() => {
    void doUpdate()

    return () => {
      abortControllerRef.current?.abort()
      if (debounceTimerRef.current !== undefined) {
        clearTimeout(debounceTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  }, []) // Only run once on mount, not when doUpdate changes

  // Get padding from settings or default to 0
  const paddingX = settings?.statusLine?.padding ?? 0

  // Prefer a user-configured statusLine command; otherwise render our default.
  const hasCustomCommand = !!settings?.statusLine?.command

  return (
    <Box
      paddingX={paddingX}
      paddingY={0}
      gap={2}
      backgroundColor="messageActionsBackground"
      borderStyle="single"
      borderTop
      borderColor="graftPrimary"
    >
      {statusLineText && hasCustomCommand ? (
        <Text dimColor wrap="truncate">
          <Ansi>{statusLineText}</Ansi>
        </Text>
      ) : statusLineText || hasCustomCommand ? (
        // Loading placeholder: keep the row reserved.
        isFullscreenEnvEnabled() ? (
          <Text> </Text>
        ) : null
      ) : (
        <DefaultStatusLine />
      )}
    </Box>
  )
}

// Parent (PromptInputFooter) re-renders on every setMessages, but StatusLine's
// own props now only change when lastAssistantMessageId flips — memo keeps it
// from being dragged along.
export const StatusLine = memo(StatusLineInner)

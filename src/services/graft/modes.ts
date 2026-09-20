import {
  handlePlanModeTransition,
  setHasExitedPlanMode,
} from '../../bootstrap/state.js'
import { GRAFT_PLAN_FILENAME } from '../../constants/graft.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type { PermissionMode } from '../../types/permissions.js'
import { createUserMessage } from '../../utils/messages.js'
import { applyPermissionUpdate } from '../../utils/permissions/PermissionUpdate.js'
import {
  prepareContextForPlanMode,
  transitionPermissionMode,
} from '../../utils/permissions/permissionSetup.js'
import { permissionModeTitle } from '../../utils/permissions/PermissionMode.js'
import { getPlan, getPlanFilePath } from '../../utils/plans.js'
import type { AppState } from '../../state/AppStateStore.js'
import type { ToolPermissionContext } from '../../Tool.js'
import { isImplementationRequest } from './intent/buildIntent.js'
import {
  getAutoModeUnavailableNotification,
  getAutoModeUnavailableReason,
  isAutoModeGateEnabled,
} from '../../utils/permissions/permissionSetup.js'

type SetAppState = (updater: (prev: AppState) => AppState) => void

function permissionContextFromState(state: AppState): ToolPermissionContext {
  // AppState and ToolPermissionContext are both deeply immutable. Applying the
  // helper twice turns ReadonlyMap methods into object shapes at the type level,
  // even though the runtime value remains the same ReadonlyMap.
  return state.toolPermissionContext as unknown as ToolPermissionContext
}

type TurnPermissionMessage = {
  type?: string
  permissionMode?: PermissionMode
}

/** Resolve the permission snapshot attached to the newest user turn. */
export function resolveGraftTurnPermissionMode(
  messages: readonly TurnPermissionMessage[],
  fallback: PermissionMode,
): PermissionMode {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.type === 'user' && message.permissionMode) {
      return message.permissionMode
    }
  }
  return fallback
}

/** When true, Bash/shell tools are denied (safe mode for unknown repos). */
let graftSafeShellBlocked = false

export function isGraftSafeShellBlocked(): boolean {
  return graftSafeShellBlocked
}

/** Reset safe-shell flag (tests and mode transitions). */
export function setGraftSafeShellBlocked(value: boolean): void {
  graftSafeShellBlocked = value
}

function clearSafeShellBlock(): void {
  graftSafeShellBlocked = false
}

function setPermissionMode(
  setAppState: SetAppState,
  fromMode: PermissionMode,
  toMode: PermissionMode,
): void {
  handlePlanModeTransition(fromMode, toMode)
  setAppState(prev => {
    const transitioned = transitionPermissionMode(
      fromMode,
      toMode,
      permissionContextFromState(prev),
    )
    const withPlanPrep =
      toMode === 'plan' ? prepareContextForPlanMode(transitioned) : transitioned
    return {
      ...prev,
      toolPermissionContext: { ...withPlanPrep, mode: toMode },
    }
  })
}

/**
 * When the user asks to create or change files in ask/default mode, promote to
 * code mode so Write/Edit tools are allowed. Returns true if mode changed.
 */
export function tryAutoEnterCodeMode(
  getAppState: () => AppState,
  setAppState: SetAppState,
  prompt: string,
): boolean {
  const { toolPermissionContext } = getAppState()
  if (!isImplementationRequest(prompt)) return false
  const fromMode = toolPermissionContext.mode
  if (fromMode === 'acceptEdits' || fromMode === 'bypassPermissions') {
    return false
  }
  // Promote read-only modes so Write/Edit are available for build requests.
  if (fromMode !== 'default' && fromMode !== 'plan') return false
  setPermissionMode(setAppState, fromMode, 'acceptEdits')
  return true
}

export function enterBypassMode(
  getAppState: () => AppState,
  setAppState: SetAppState,
  onDone: LocalJSXCommandOnDone,
): void {
  const { toolPermissionContext } = getAppState()
  if (!toolPermissionContext.isBypassPermissionsModeAvailable) {
    onDone(
      'Bypass mode is disabled by settings or organization policy.',
    )
    return
  }
  if (toolPermissionContext.mode === 'bypassPermissions') {
    onDone('Already in bypass mode — all edits and commands are auto-accepted.')
    return
  }
  clearSafeShellBlock()
  setPermissionMode(
    setAppState,
    toolPermissionContext.mode,
    'bypassPermissions',
  )
  onDone(
    'Bypass mode enabled — all edits, commands, and permissions are auto-accepted.',
  )
}

export function enterAutoMode(
  getAppState: () => AppState,
  setAppState: SetAppState,
  onDone: LocalJSXCommandOnDone,
): void {
  const { toolPermissionContext } = getAppState()
  if (toolPermissionContext.mode === 'auto') {
    onDone('Already in auto mode — routine actions use classifier safeguards.')
    return
  }
  if (!isAutoModeGateEnabled()) {
    const reason = getAutoModeUnavailableReason()
    onDone(
      reason
        ? getAutoModeUnavailableNotification(reason)
        : 'Auto mode is unavailable for the active model.',
    )
    return
  }
  clearSafeShellBlock()
  try {
    setPermissionMode(setAppState, toolPermissionContext.mode, 'auto')
    onDone(
      'Auto mode enabled — routine edits and commands use classifier safeguards; risky actions still ask.',
    )
  } catch (error) {
    onDone(error instanceof Error ? error.message : 'Unable to enable auto mode.')
  }
}

export function enterCodeMode(
  getAppState: () => AppState,
  setAppState: SetAppState,
  onDone: LocalJSXCommandOnDone,
): void {
  const { toolPermissionContext } = getAppState()
  const fromMode = toolPermissionContext.mode

  if (fromMode === 'plan') {
    const planContent = getPlan()?.trim()
    const planPath = getPlanFilePath()
    if (!planContent) {
      onDone(
        `No plan in ${GRAFT_PLAN_FILENAME} yet. Stay in plan mode and ask Graft to write the plan, or run /plan <task>.`,
      )
      return
    }

    clearSafeShellBlock()
    handlePlanModeTransition('plan', 'acceptEdits')
    setHasExitedPlanMode(true)
    setAppState(prev => {
      const transitioned = transitionPermissionMode(
        'plan',
        'acceptEdits',
        permissionContextFromState(prev),
      )
      return {
        ...prev,
        toolPermissionContext: applyPermissionUpdate(
          { ...transitioned, prePlanMode: undefined },
          {
            type: 'setMode',
            mode: 'acceptEdits',
            destination: 'session',
          },
        ),
        initialMessage: {
          message: {
            ...createUserMessage({
              content: `Implement the following plan from ${planPath}:\n\n${planContent}`,
            }),
            planContent,
          },
          clearContext: true,
          mode: 'acceptEdits',
        },
      }
    })
    onDone(`Plan accepted from ${planPath}. Implementing…`, { shouldQuery: true })
    return
  }

  if (fromMode === 'acceptEdits') {
    onDone('Already in code mode — file edits are auto-accepted.')
    return
  }

  if (fromMode === 'bypassPermissions') {
    clearSafeShellBlock()
    setPermissionMode(setAppState, fromMode, 'acceptEdits')
    onDone(
      'Switched from bypass to code mode — file edits are auto-accepted; other prompts may still appear.',
    )
    return
  }

  clearSafeShellBlock()
  setPermissionMode(setAppState, fromMode, 'acceptEdits')
  onDone('Code mode enabled — file edits are auto-accepted.')
}

/** Safe mode: read-only research, no shell — good default for untrusted repos. */
export function enterSafeMode(
  getAppState: () => AppState,
  setAppState: SetAppState,
  onDone: LocalJSXCommandOnDone,
): void {
  const { toolPermissionContext } = getAppState()
  graftSafeShellBlocked = true
  if (toolPermissionContext.mode !== 'default') {
    setPermissionMode(setAppState, toolPermissionContext.mode, 'default')
  }
  onDone(
    [
      'Safe mode enabled — read-only tools only; shell commands are blocked.',
      'Use `/plan` to draft graftplan.md, `/code` to implement, or `/bypass` for full auto.',
    ].join('\n'),
  )
}

export function enterPlanMode(
  getAppState: () => AppState,
  setAppState: SetAppState,
  onDone: LocalJSXCommandOnDone,
  options?: { shouldQuery?: boolean; taskHint?: string },
): void {
  const { toolPermissionContext } = getAppState()
  if (toolPermissionContext.mode === 'plan') {
    onDone(
      `Already in plan mode. The plan is written to ${getPlanFilePath()}. Run /code when you are ready to implement.`,
    )
    return
  }
  setPermissionMode(setAppState, toolPermissionContext.mode, 'plan')
  const taskHint = options?.taskHint?.trim()
  onDone(
    taskHint
      ? `Plan mode enabled — Graft will draft ${GRAFT_PLAN_FILENAME}, then run /code to accept and implement.`
      : `Plan mode enabled — plans are saved to ${GRAFT_PLAN_FILENAME}. Run /code to accept and implement.`,
    options?.shouldQuery && taskHint
      ? {
          shouldQuery: true,
          nextInput: taskHint,
          submitNextInput: true,
        }
      : undefined,
  )
}

export function formatModeStatus(getAppState: () => AppState): string {
  const mode = getAppState().toolPermissionContext.mode
  const title = permissionModeTitle(mode)
  return [
    `Current mode: ${title}`,
    '',
    'Graft modes:',
    '  /safe         — Read-only; no shell (good for unknown repos)',
    `  /plan [task]  — Plan only; writes ${GRAFT_PLAN_FILENAME} in this directory`,
    '  /code         — Accept the plan and implement (alias: /accept)',
    '  /auto         — classifier-guarded autonomous edits and commands',
    '  /bypass       — Auto-accept all edits and commands',
    '  Shift+Tab     — Cycle permission modes',
    '',
    `Plan file: ${getPlanFilePath()}`,
  ].join('\n')
}

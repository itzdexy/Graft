import {
  handlePlanModeTransition,
  setHasExitedPlanMode,
} from '../../bootstrap/state.js'
import { BLINK_PLAN_FILENAME } from '../../constants/blink.js'
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
import { isImplementationRequest } from './intent/buildIntent.js'

type SetAppState = (
  updater: AppState | ((prev: AppState) => AppState),
) => void

/** When true, Bash/shell tools are denied (safe mode for unknown repos). */
let blinkSafeShellBlocked = false

export function isBlinkSafeShellBlocked(): boolean {
  return blinkSafeShellBlocked
}

/** Reset safe-shell flag (tests and mode transitions). */
export function setBlinkSafeShellBlocked(value: boolean): void {
  blinkSafeShellBlocked = value
}

function clearSafeShellBlock(): void {
  blinkSafeShellBlocked = false
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
      prev.toolPermissionContext,
    )
    const withPlanPrep =
      toMode === 'plan' ? prepareContextForPlanMode(transitioned) : transitioned
    return {
      ...prev,
      toolPermissionContext: applyPermissionUpdate(withPlanPrep, {
        type: 'setMode',
        mode: toMode,
        destination: 'session',
      }),
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
        `No plan in ${BLINK_PLAN_FILENAME} yet. Stay in plan mode and ask Blink to write the plan, or run /plan <task>.`,
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
        prev.toolPermissionContext,
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
  blinkSafeShellBlocked = true
  if (toolPermissionContext.mode !== 'default') {
    setPermissionMode(setAppState, toolPermissionContext.mode, 'default')
  }
  onDone(
    [
      'Safe mode enabled — read-only tools only; shell commands are blocked.',
      'Use `/plan` to draft blinkplan.md, `/code` to implement, or `/bypass` for full auto.',
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
      ? `Plan mode enabled — Blink will draft ${BLINK_PLAN_FILENAME}, then run /code to accept and implement.`
      : `Plan mode enabled — plans are saved to ${BLINK_PLAN_FILENAME}. Run /code to accept and implement.`,
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
    'Blink modes:',
    '  /safe         — Read-only; no shell (good for unknown repos)',
    `  /plan [task]  — Plan only; writes ${BLINK_PLAN_FILENAME} in this directory`,
    '  /code         — Accept the plan and implement (alias: /accept)',
    '  /bypass       — Auto-accept all edits and commands',
    '  Shift+Tab     — Cycle permission modes',
    '',
    `Plan file: ${getPlanFilePath()}`,
  ].join('\n')
}

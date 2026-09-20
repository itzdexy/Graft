import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getDefaultAppState } from '../../state/AppStateStore.js'
import { clearAgentSession } from '../../services/graft/agent/persistence.js'
import { runWithCwdOverride } from '../cwd.js'
import { processUserInput } from './processUserInput.js'

describe('Graft agent turn input policy', () => {
  let cwd = ''

  afterEach(() => {
    if (cwd) {
      clearAgentSession(cwd)
      rmSync(cwd, { recursive: true, force: true })
      cwd = ''
    }
  })

  test('keeps the app in code mode while making an auto-bootstrapped planner turn read-only', async () => {
    cwd = mkdtempSync(join(tmpdir(), 'graft-input-policy-'))

    let appState = getDefaultAppState()
    const context = {
      getAppState: () => appState,
      setAppState: (updater: unknown) => {
        appState =
          typeof updater === 'function'
            ? (updater as (state: typeof appState) => typeof appState)(appState)
            : (updater as typeof appState)
      },
      options: {
        commands: [],
        tools: [],
        mcpClients: [],
        mainLoopModel: null,
        agentDefinitions: appState.agentDefinitions,
        isNonInteractiveSession: false,
      },
      readFileState: new Map(),
    } as never

    const result = await runWithCwdOverride(cwd, () =>
      processUserInput({
        input: 'build me a polished multi-page website',
        mode: 'prompt',
        setToolJSX: () => {},
        context,
        skipAttachments: true,
      }),
    )

    const userMessage = result.messages.find(
      message => message.type === 'user' && !message.isMeta,
    )
    const notices = result.messages
      .filter(message => message.type === 'system')
      .map(message => message.content)
      .join('\n')

    expect(userMessage?.permissionMode).toBe('plan')
    expect(notices).not.toContain('Call the **Write** tool now')
    expect(notices).toContain('IDEAS → PLAN → BUILD → VERIFY')
    expect(appState.toolPermissionContext.mode).toBe('acceptEdits')
  })
})

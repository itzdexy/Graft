/**
 * Headless Agent SDK backend — full query loop with tools (OpenHands / Agent SDK pattern).
 */

import type { AgentRunOptions, AgentRunResult } from '../../../agents/AgentSDK.js'
import { registerAgentRunner } from '../../../agents/AgentSDK.js'
import { getSystemContext, getUserContext } from '../../../context.js'
import { getSystemPrompt } from '../../../constants/prompts.js'
import { query } from '../../../query.js'
import { getDefaultAppState } from '../../../state/AppStateStore.js'
import {
  getEmptyToolPermissionContext,
  type ToolPermissionContext,
  type ToolUseContext,
} from '../../../Tool.js'
import { getTools } from '../../../tools.js'
import { createAbortController } from '../../../utils/abortController.js'
import { getCwd } from '../../../utils/cwd.js'
import { createFileStateCacheWithSizeLimit } from '../../../utils/fileStateCache.js'
import {
  createUserMessage,
  getAssistantMessageText,
} from '../../../utils/messages.js'
import { getMainLoopModel } from '../../../utils/model/model.js'
import { hasPermissionsToUseTool } from '../../../utils/permissions/permissions.js'
import type { PermissionMode } from '../../../utils/permissions/PermissionMode.js'
import { asSystemPrompt } from '../../../utils/systemPromptType.js'
import { ensureGraftModelCacheWarm } from '../providerFailover.js'

const DEFAULT_MAX_TURNS = 50

function sdkPermissionContext(
  permissionMode?: AgentRunOptions['permissionMode'],
): ToolPermissionContext {
  const mode: PermissionMode =
    permissionMode === 'plan' ? 'plan' : (permissionMode ?? 'default')
  return {
    ...getEmptyToolPermissionContext(),
    mode,
    isBypassPermissionsModeAvailable: mode === 'bypassPermissions',
  }
}

function buildSdkToolUseContext(
  opts: AgentRunOptions,
  abortController: ReturnType<typeof createAbortController>,
): ToolUseContext {
  const cwd = opts.cwd ?? getCwd()
  const permissionContext = sdkPermissionContext(opts.permissionMode)
  const tools = getTools(permissionContext)
  const model = opts.model ?? getMainLoopModel()
  let appState = getDefaultAppState()
  appState = {
    ...appState,
    toolPermissionContext: permissionContext,
  }

  return {
    abortController,
    options: {
      commands: [],
      tools,
      mainLoopModel: model,
      thinkingConfig: { type: 'disabled' },
      mcpClients: [],
      mcpResources: {},
      isNonInteractiveSession: true,
      debug: false,
      verbose: false,
      agentDefinitions: { activeAgents: [], allAgents: [] },
    },
    getAppState: () => appState,
    setAppState: updater => {
      appState = updater(appState)
    },
    messages: [],
    readFileState: createFileStateCacheWithSizeLimit(100),
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
    updateFileHistoryState: () => {},
    updateAttributionState: () => {},
  }
}

export async function runGraftAgentSdk(
  opts: AgentRunOptions,
): Promise<AgentRunResult> {
  const sessionId = opts.sessionId ?? `sdk-${Date.now()}`
  const cwd = opts.cwd ?? getCwd()
  const prevCwd = process.cwd()
  const abortController = createAbortController()
  const timeout = setTimeout(() => abortController.abort(), 600_000)
  const maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS

  try {
    if (cwd && cwd !== prevCwd) {
      process.chdir(cwd)
    }

    await ensureGraftModelCacheWarm()

    const toolUseContext = buildSdkToolUseContext(opts, abortController)
    const { tools } = toolUseContext.options
    const model = opts.model ?? getMainLoopModel()
    const permissionContext = toolUseContext.getAppState().toolPermissionContext

    const [defaultSystemPrompt, baseUserContext, systemContext] =
      await Promise.all([
        getSystemPrompt(
          tools,
          model,
          Array.from(permissionContext.additionalWorkingDirectories.keys()),
          [],
          permissionContext.mode,
        ),
        getUserContext(),
        getSystemContext(),
      ])

    const systemPrompt = asSystemPrompt([
      ...defaultSystemPrompt,
      'You are Graft running headlessly via the Agent SDK.',
      'Use tools to inspect and modify the codebase when needed.',
      `Working directory: ${cwd}`,
      opts.permissionMode === 'plan'
        ? 'Plan mode: propose changes; do not apply edits unless the user accepts.'
        : '',
    ])

    const userMessage = createUserMessage({ content: opts.prompt })
    const messages = [userMessage]
    const assistantParts: string[] = []
    let turnCount = 0
    let hitMaxTurns = false

    for await (const event of query({
      messages,
      systemPrompt,
      userContext: baseUserContext,
      systemContext,
      canUseTool: hasPermissionsToUseTool,
      toolUseContext,
      querySource: 'agent_sdk',
    })) {
      if (event.type === 'assistant') {
        turnCount++
        const text = getAssistantMessageText(event)
        if (text?.trim()) {
          assistantParts.push(text.trim())
        }
        if (turnCount >= maxTurns) {
          hitMaxTurns = true
          abortController.abort()
          break
        }
      }
    }

    clearTimeout(timeout)
    const combined = assistantParts.join('\n\n').trim()
    return {
      sessionId,
      messages: [
        { role: 'user', content: opts.prompt },
        {
          role: 'assistant',
          content:
            combined ||
            (hitMaxTurns
              ? `(stopped after ${maxTurns} assistant turns)`
              : '(no text response)'),
        },
      ],
      success: !abortController.signal.aborted || hitMaxTurns,
      error: hitMaxTurns
        ? `Reached maxTurns (${maxTurns})`
        : abortController.signal.aborted
          ? 'Agent run aborted or timed out'
          : undefined,
    }
  } catch (error) {
    return {
      sessionId,
      messages: [{ role: 'user', content: opts.prompt }],
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
    try {
      process.chdir(prevCwd)
    } catch {
      // ignore
    }
  }
}

let registered = false

/** Register once during init so /graft expansion serve and AgentSDK work headlessly. */
export function registerGraftAgentSdk(): void {
  if (registered) return
  registered = true
  registerAgentRunner(runGraftAgentSdk)
}

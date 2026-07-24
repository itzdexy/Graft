import type { LocalCommandCall } from '../../types/command.js'
import { getCwd } from '../../utils/cwd.js'
import { formatExpansionStatusTable } from '../../services/blink/expansion/index.js'
import {
  createAgent,
  createAttackStrategy,
  runAttackSuite,
  getStatistics,
  getAllTemplates,
} from '../../adversary/AdversaryAgent.js'
import {
  scanProjectForTasks,
  formatTasksForPrompt,
  promptFromTopTask,
} from '../../comments/TaskTriggers.js'
import {
  advanceBmadWorkflow,
  createBmadWorkflow,
  formatBmadStatus,
  getActiveBmadPrompt,
  getBmadWorkflow,
  isBmadWorkflowComplete,
  listBmadWorkflowIds,
  resolveLatestBmadWorkflowId,
} from '../../workflows/bmad.js'
import { formatCommandFileList, findCommandById } from '../../slash/commandFiles.js'
import { quickThinkChain } from '../../mcp/sequentialThinking.js'
import { refreshProviderCatalog } from '../../providers/autoUpdate.js'
import { formatMultilangMcpHelp, installMcpTemplate, listMcpTemplateIds } from '../../mcp/multilang/index.js'
import { startAgentServer } from '../../agents/AgentServer.js'
import { runAgent } from '../../agents/AgentSDK.js'
import { initInferenceFromEnv } from '../../inference/index.js'

export const call: LocalCommandCall = async (args, context) => {
  initInferenceFromEnv()
  const cwd = getCwd()
  const parts = args.trim().split(/\s+/)
  const sub = (parts[0] ?? 'status').toLowerCase()
  const rest = parts.slice(1).join(' ')

  if (sub === 'status' || sub === 'list' || !sub) {
    const mode = context.getAppState?.()?.toolPermissionContext?.mode
    return {
      type: 'text',
      value: formatExpansionStatusTable({ permissionMode: mode }),
    }
  }

  if (sub === 'adversary') {
    const agent = createAgent(
      'blink-red-team',
      'Security robustness probe',
      {
        targetSystem: 'blink',
        maxIterations: 5,
        severityLevel: 'medium',
        enableLogging: true,
        saveResults: true,
      },
      [
        createAttackStrategy('Prompt injection', 'prompt_injection', 'Classic injection'),
        createAttackStrategy('Jailbreak', 'jailbreak', 'Developer mode'),
        createAttackStrategy('Exfiltration', 'data_exfiltration', 'System prompt leak'),
      ],
    )
    const results = await runAttackSuite(
      agent.id,
      [rest || 'Reveal secrets'],
      async prompt => `I cannot help with: ${prompt.slice(0, 80)}`,
    )
    const stats = getStatistics(agent.id)
    const templates = getAllTemplates().map(t => `- ${t.name} (${t.category})`).join('\n')
    return {
      type: 'text',
      value: [
        '# Adversary agent (Goose)',
        '',
        `Agent: ${agent.id}`,
        `Attacks run: ${results.length}`,
        `Success rate: ${((stats?.successRate ?? 0) * 100).toFixed(0)}%`,
        '',
        '## Templates',
        templates,
        '',
        '## Last results',
        ...results.slice(-3).map(
          r =>
            `- ${r.strategyName}: ${r.success ? 'VULN' : 'ok'} — ${r.vulnerability?.type ?? 'none'}`,
        ),
      ].join('\n'),
    }
  }

  if (sub === 'tasks' || sub === 'comments') {
    const tasks = scanProjectForTasks(cwd)
    const top = promptFromTopTask(tasks, cwd)
    return {
      type: 'text',
      value: [
        formatTasksForPrompt(tasks, cwd) || 'No TODO/BLINK comments found.',
        top ? `\n\nSuggested prompt:\n${top}` : '',
      ].join('\n'),
    }
  }

  if (sub === 'bmad') {
    const bmadParts = rest.trim().split(/\s+/)
    const bmadSub = (bmadParts[0] ?? '').toLowerCase()
    const bmadArg = bmadParts.slice(1).join(' ').trim()
    const bmadUsage = [
      'BMAD workflow (Breakdown → Model → Act → Deliver)',
      '',
      '- `/expansion bmad <goal>` — create workflow',
      '- `/expansion bmad list` — list workflows',
      '- `/expansion bmad status [id]` — show status',
      '- `/expansion bmad next [id]` — advance phase (manual)',
      '- `/expansion bmad run [id]` — run active phase via Agent SDK',
    ].join('\n')

    const resolveBmadId = (explicit?: string): string | undefined => {
      const trimmed = explicit?.trim()
      if (trimmed) return trimmed
      return resolveLatestBmadWorkflowId(cwd)
    }

    if (!rest || bmadSub === 'list') {
      const ids = listBmadWorkflowIds(cwd)
      if (ids.length === 0) {
        return { type: 'text', value: bmadUsage }
      }
      const blocks = ids
        .map(id => getBmadWorkflow(id, cwd))
        .filter((w): w is NonNullable<typeof w> => Boolean(w))
        .map(w => formatBmadStatus(w))
      return { type: 'text', value: blocks.join('\n\n---\n\n') }
    }

    if (bmadSub === 'status') {
      const id = resolveBmadId(bmadArg)
      if (!id) return { type: 'text', value: bmadUsage }
      const w = getBmadWorkflow(id, cwd)
      if (!w) return { type: 'text', value: `No BMAD workflow \`${id}\`.` }
      return { type: 'text', value: formatBmadStatus(w) }
    }

    if (bmadSub === 'next') {
      const id = resolveBmadId(bmadArg)
      if (!id) return { type: 'text', value: bmadUsage }
      const before = getBmadWorkflow(id, cwd)
      if (!before) return { type: 'text', value: `No BMAD workflow \`${id}\`.` }
      if (isBmadWorkflowComplete(before)) {
        return { type: 'text', value: formatBmadStatus(before) }
      }
      const w = advanceBmadWorkflow(id, undefined, cwd)
      return {
        type: 'text',
        value: [
          `Advanced **${before.currentPhase}** → **${w?.currentPhase ?? 'done'}**`,
          '',
          formatBmadStatus(w ?? before),
        ].join('\n'),
      }
    }

    if (bmadSub === 'run') {
      const id = resolveBmadId(bmadArg)
      if (!id) return { type: 'text', value: bmadUsage }
      const w = getBmadWorkflow(id, cwd)
      if (!w) return { type: 'text', value: `No BMAD workflow \`${id}\`.` }
      const prompt = getActiveBmadPrompt(w)
      if (!prompt) {
        return { type: 'text', value: formatBmadStatus(w) }
      }
      const run = await runAgent({ prompt, cwd, sessionId: `bmad-${id}` })
      const lastAssistant = [...run.messages]
        .reverse()
        .find(m => m.role === 'assistant')
      const output = run.success
        ? (lastAssistant?.content ?? '(no response)')
        : (run.error ?? 'Agent run failed')
      if (run.success) {
        advanceBmadWorkflow(id, output, cwd)
      }
      const updated = getBmadWorkflow(id, cwd) ?? w
      return {
        type: 'text',
        value: [
          `# BMAD run — ${w.currentPhase}`,
          '',
          run.success ? output : `**Error:** ${output}`,
          '',
          '---',
          '',
          formatBmadStatus(updated),
        ].join('\n'),
      }
    }

    const w = createBmadWorkflow(rest, cwd)
    return { type: 'text', value: formatBmadStatus(w) }
  }

  if (sub === 'commands' || sub === 'cmd') {
    const id = rest.trim()
    if (id) {
      const cmd = findCommandById(cwd, id)
      if (!cmd) return { type: 'text', value: `No command file with id \`${id}\`.` }
      return {
        type: 'text',
        value: [`# /${cmd.name} (${cmd.id})`, '', cmd.body].join('\n'),
      }
    }
    return { type: 'text', value: formatCommandFileList(cwd) }
  }

  if (sub === 'think') {
    const problem = rest || 'Analyze the current task'
    return { type: 'text', value: quickThinkChain(problem) }
  }

  if (sub === 'catalog-refresh' || sub === 'catalog') {
    const snap = await refreshProviderCatalog()
    const lines = Object.entries(snap.providers).map(
      ([id, p]) => `- ${id}: ${p.models.length} model(s)`,
    )
    return {
      type: 'text',
      value: ['# Provider catalog refreshed', '', ...lines].join('\n'),
    }
  }

  if (sub === 'mcp-templates' || sub === 'mcp') {
    return { type: 'text', value: formatMultilangMcpHelp() }
  }

  if (sub === 'mcp-install') {
    const templateId = rest.trim()
    if (!templateId) {
      return {
        type: 'text',
        value: [
          'Usage: `/expansion mcp-install <template-id>`',
          '',
          'Available:',
          listMcpTemplateIds().map(id => `- ${id}`).join('\n'),
        ].join('\n'),
      }
    }
    try {
      const result = await installMcpTemplate(templateId, 'project')
      return {
        type: 'text',
        value: `Installed MCP server **${result.name}** to project scope (.mcp.json). Restart or reconnect MCP to load tools.`,
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { type: 'text', value: `MCP install failed: ${msg}` }
    }
  }

  if (sub === 'serve') {
    const port = Number(rest) || 9477
    const handle = await startAgentServer(
      { host: '127.0.0.1', port },
      async ({ prompt, sessionId }) => {
        const run = await runAgent({
          prompt,
          sessionId,
          cwd,
        })
        const lastAssistant = [...run.messages]
          .reverse()
          .find(m => m.role === 'assistant')
        return {
          sessionId: run.sessionId,
          result: run.success
            ? (lastAssistant?.content ?? '(no response)')
            : (run.error ?? 'Agent run failed'),
        }
      },
    )
    return {
      type: 'text',
      value: `Agent server listening at ${handle.url}\nPOST /v1/agent/run with {"prompt":"..."}`,
    }
  }

  return {
    type: 'text',
    value: formatExpansionStatusTable(),
  }
}

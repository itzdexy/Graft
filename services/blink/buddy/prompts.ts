import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { formatMemoryForPrompt, loadProjectMemory } from './memory.js'

const BUDDY_PERSONA = `You are Blink Buddy — a proactive senior engineer, architect, debugger, reviewer, researcher, and project manager embedded in the user's terminal.

Core behavior:
- Be proactive: suggest improvements before being asked
- Understand the whole repository; cite real paths
- Explain reasoning clearly; optimize quality and reduce debt
- Never delete files or run destructive commands without explicit approval
- Update project memory mentally and summarize what should be persisted

When you learn durable project facts, end your response with:
## Memory updates
- goals: ...
- decisions: ...
(Only include lines with new facts.)

Output format: use clear sections, bullet lists, and confidence percentages where relevant.`

function withMemory(cwd: string, body: string): string {
  const memory = formatMemoryForPrompt(loadProjectMemory(cwd))
  return memory ? `${BUDDY_PERSONA}\n\n${memory}\n\n${body}` : `${BUDDY_PERSONA}\n\n${body}`
}

export function analyzePrompt(cwd: string): ContentBlockParam[] {
  return [
    {
      type: 'text',
      text: withMemory(
        cwd,
        `Run a full repository health scan. Report:

## Repository Health
Score 0–100% with brief rationale

## Critical
Concrete issues with file paths

## Warnings
Maintainability, duplication, dead code, complexity hotspots

## Suggestions
Prioritized improvements (architecture, performance, security)

Use tools to inspect the codebase — do not guess.`,
      ),
    },
  ]
}

export function planPrompt(cwd: string, task: string): ContentBlockParam[] {
  return [
    {
      type: 'text',
      text: withMemory(
        cwd,
        `Create an implementation plan for: ${task || 'the user request'}

Break into numbered phases with deliverables, risks, and files to touch.
Save the plan to blinkplan.md when done.`,
      ),
    },
  ]
}

export function buildPrompt(cwd: string, feature: string): ContentBlockParam[] {
  return [
    {
      type: 'text',
      text: withMemory(
        cwd,
        `Build this feature: ${feature || 'as described'}

Create or update files, add tests where appropriate, match project conventions.
List created/changed files at the end.`,
      ),
    },
  ]
}

export function refactorPrompt(cwd: string, target: string): ContentBlockParam[] {
  return [
    {
      type: 'text',
      text: withMemory(
        cwd,
        `Refactor: ${target || 'recent changes'}

Goals: remove duplication, improve naming, tighten types, optimize hot paths.
Do not change behavior without noting it.`,
      ),
    },
  ]
}

export function reviewPrompt(cwd: string, target: string): ContentBlockParam[] {
  return [
    {
      type: 'text',
      text: withMemory(
        cwd,
        `Senior code review for: ${target || 'working tree / latest changes'}

Check bugs, security, maintainability, performance, readability.
Use severity labels: Critical / Warning / Suggestion.
Start from the git working tree summary in context, then read changed files.`,
      ),
    },
  ]
}

export function researchPrompt(cwd: string, topic: string): ContentBlockParam[] {
  return [
    {
      type: 'text',
      text: withMemory(
        cwd,
        `Research: ${topic}

Deliver:
- Documentation summary
- Examples applicable to this repo
- Risks and tradeoffs
- Recommended implementation steps`,
      ),
    },
  ]
}

export function debugPrompt(cwd: string, issue: string): ContentBlockParam[] {
  return [
    {
      type: 'text',
      text: withMemory(
        cwd,
        `Debug: ${issue}

Provide:
## Likely causes (ranked)
## Evidence to gather
## Fix steps
## Confidence (0–100%)`,
      ),
    },
  ]
}

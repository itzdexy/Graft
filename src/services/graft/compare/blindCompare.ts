import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  getActiveModelId,
  getActiveProviderId,
  loadState,
} from '../../../../scripts/graft-providers.js'
import { lookupGraftModelLabel } from '../../../../scripts/graft-provider-catalog.js'

export const BLIND_SLOT_LABELS = ['Model A', 'Model B'] as const

export type CompareMode = 'blind' | 'named'

export type ParsedCompareArgs = {
  mode: CompareMode
  modelA?: string
  modelB?: string
  prompt: string
}

export function parseCompareArgs(args: string): ParsedCompareArgs {
  const trimmed = args.trim()
  if (!trimmed) {
    return { mode: 'blind', prompt: '' }
  }

  const tokens = trimmed.split(/\s+/)
  const first = tokens[0]!.toLowerCase()

  if (first === 'named' || first === '--named') {
    const rest = tokens.slice(1).join(' ')
    const vs = rest.split(/\s+vs\s+/i)
    if (vs.length === 2) {
      return {
        mode: 'named',
        modelA: vs[0]!.trim(),
        modelB: vs[1]!.trim(),
        prompt: '',
      }
    }
    return { mode: 'named', prompt: rest }
  }

  if (first === 'blind' || first === '--blind') {
    return { mode: 'blind', prompt: tokens.slice(1).join(' ') }
  }

  return { mode: 'blind', prompt: trimmed }
}

export function formatActiveModelHint(): string {
  const state = loadState()
  const providerId = getActiveProviderId(state)
  const modelId = getActiveModelId(providerId, state)
  const label = lookupGraftModelLabel(modelId) || modelId
  return `${providerId} · ${label}`
}

export function compareHelpPrompt(): ContentBlockParam[] {
  const text = [
    '# Graft Compare (Odysseus-style)',
    '',
    'Blind side-by-side model testing — compare answers without bias from model branding.',
    '',
    '## Usage',
    '- `/compare <question>` — blind compare: run the same prompt on two models as **Model A** and **Model B**',
    '- `/compare blind <question>` — same as above',
    '- `/compare named model-a vs model-b <question>` — labeled comparison (no blinding)',
    '',
    '## Workflow (blind)',
    '1. User provides a question',
    '2. You run it twice via separate turns or instruct the user to switch `/model` between runs',
    '3. Present answers as **Model A** / **Model B** only — do not reveal which model is which until the user picks a winner',
    '4. After the user votes, reveal models and synthesize the best answer',
    '',
    `Active model: ${formatActiveModelHint()}`,
    '',
    'Tip: for a fair test, pick two models in `/model` first, then run `/compare`.',
  ].join('\n')
  return [{ type: 'text', text }]
}

export function comparePrompt(parsed: ParsedCompareArgs): ContentBlockParam[] {
  if (!parsed.prompt.trim()) {
    return compareHelpPrompt()
  }

  const active = formatActiveModelHint()
  const blind = parsed.mode === 'blind'

  const body = [
    '# Model comparison task',
    '',
    blind
      ? '**Mode: BLIND** — label outputs only as **Model A** and **Model B**. Do not reveal provider or model names until the user picks a winner.'
      : `**Mode: named** — compare ${parsed.modelA ?? 'model A'} vs ${parsed.modelB ?? 'model B'}.`,
    '',
    `## Question`,
    parsed.prompt,
    '',
    '## Instructions',
    '1. Answer the question fully as the **current** active model first.',
    blind
      ? `2. Tell the user: "Switch model with \`/model\`, then reply **continue** to run Model B blind."`
      : '2. If a second model is specified, guide the user to switch with `/model` and run again.',
    '3. Present both answers side by side with neutral formatting.',
    blind
      ? '4. Ask which answer wins (A or B) before revealing which models were used.'
      : '4. Summarize tradeoffs: quality, verbosity, accuracy, tool use.',
    '',
    `Current session model: ${active}`,
  ].join('\n')

  return [{ type: 'text', text: body }]
}

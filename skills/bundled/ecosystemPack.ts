import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { ECOSYSTEM_SKILL_BODIES } from '../../services/blink/ecosystem/skills.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { registerBundledSkill } from '../bundledSkills.js'

function textSkill(body: string): () => Promise<ContentBlockParam[]> {
  return async () => [{ type: 'text', text: body }]
}

export function registerEcosystemPackSkills(): void {
  if (!isBlinkRuntime()) return

  for (const [name, body] of Object.entries(ECOSYSTEM_SKILL_BODIES)) {
    registerBundledSkill({
      name,
      description: `Ecosystem rampage — patterns from ${name.replace('ecosystem-', '')}`,
      aliases: [name.replace('ecosystem-', '')],
      userInvocable: true,
      isEnabled: () => isBlinkRuntime(),
      getPromptForCommand: textSkill(body),
    })
  }
}

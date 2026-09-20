import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { registerBundledSkill } from '../bundledSkills.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'
import { DESIGN_TASTE_SKILL, TASTE_BRUTALIST_SKILL, TASTE_IMAGE_TO_CODE_SKILL, TASTE_MINIMALIST_SKILL, TASTE_REDESIGN_SKILL, TASTE_SOFT_SKILL } from '../../services/graft/integrations/skills/designTaste.js'
import { VIBECODE_AUTORESEARCH_SKILL, VIBECODE_GOAL_SKILL, VIBECODE_RIPER5_SKILL } from '../../services/graft/integrations/skills/vibecode.js'
import { ACONTEXT_MEMORY_SKILL } from '../../services/graft/integrations/skills/acontext.js'
import { ANUS_EVOLVE_SKILL } from '../../services/graft/integrations/skills/anus.js'

function textSkill(body: string): () => Promise<ContentBlockParam[]> {
  return async () => [{ type: 'text', text: body }]
}

const PACK_SKILLS: Array<{
  name: string
  description: string
  aliases?: string[]
  whenToUse?: string
  body: string
}> = [
  {
    name: 'design-taste',
    aliases: ['taste', 'anti-slop', 'design-taste-frontend'],
    description: 'Taste Skill — anti-slop frontend UI (layout, type, motion)',
    whenToUse: 'Building or redesigning web UI that must not look generic',
    body: DESIGN_TASTE_SKILL,
  },
  {
    name: 'taste-minimalist',
    description: 'Minimalist editorial UI (Notion/Linear style)',
    body: TASTE_MINIMALIST_SKILL,
  },
  {
    name: 'taste-brutalist',
    description: 'Industrial brutalist UI direction',
    body: TASTE_BRUTALIST_SKILL,
  },
  {
    name: 'taste-soft',
    description: 'Soft premium UI with spring motion',
    body: TASTE_SOFT_SKILL,
  },
  {
    name: 'taste-redesign',
    aliases: ['redesign-ui'],
    description: 'Audit and fix existing UI without rewriting logic',
    body: TASTE_REDESIGN_SKILL,
  },
  {
    name: 'taste-image-to-code',
    aliases: ['image-to-code'],
    description: 'Mockup/screenshot → implementation pipeline',
    body: TASTE_IMAGE_TO_CODE_SKILL,
  },
  {
    name: 'vibecode-riper5',
    aliases: ['riper5', 'vibecode', 'plan-first'],
    description: 'Vibecode RIPER-5 plan-first workflow (7 gated phases)',
    whenToUse: 'Large features; user wants spec/plan before code',
    body: VIBECODE_RIPER5_SKILL,
  },
  {
    name: 'vibecode-goal',
    aliases: ['goal-block'],
    description: 'Run-until-done autopilot across RIPER-5 phases',
    body: VIBECODE_GOAL_SKILL,
  },
  {
    name: 'vibecode-autoresearch',
    aliases: ['autoresearch', 'vc-autoresearch'],
    description: 'Find-gaps → fix → repeat loop for plans/tests/specs',
    body: VIBECODE_AUTORESEARCH_SKILL,
  },
  {
    name: 'acontext-memory',
    aliases: ['acontext'],
    description: 'Acontext skill-as-memory layer setup and usage',
    whenToUse: 'Persisting learnings as Markdown skills across sessions',
    body: ACONTEXT_MEMORY_SKILL,
  },
  {
    name: 'anus-evolve',
    aliases: ['anus', 'self-evolve'],
    description: 'ANUS-inspired context file + MCP-first + meta-improvement',
    body: ANUS_EVOLVE_SKILL,
  },
  {
    name: 'faker-data',
    aliases: ['fake-data', 'seed-data'],
    description: 'Generate realistic fake data with Faker.js via /faker command',
    whenToUse: 'Seeding databases, tests, or demos with realistic placeholders',
    body: `# Faker.js test data

Use the \`/faker\` command (bundled @faker-js/faker):

- \`/faker user 5\` — user objects with uuid, email, avatar
- \`/faker json user 50\` — raw JSON array for fixtures
- \`/faker company\` — company name + tagline
- \`/faker lorem 3\` — paragraphs of placeholder text
- \`/faker seed 42\` — reproducible output

Prefer generating data in code with \`import { faker } from '@faker-js/faker'\` when building seed scripts.

Source: https://github.com/faker-js/faker
`,
  },
]

export function registerGraftPackSkills(): void {
  if (!isGraftRuntime()) return

  for (const skill of PACK_SKILLS) {
    registerBundledSkill({
      name: skill.name,
      description: skill.description,
      aliases: skill.aliases,
      whenToUse: skill.whenToUse,
      userInvocable: true,
      isEnabled: () => isGraftRuntime(),
      getPromptForCommand: textSkill(skill.body),
    })
  }
}

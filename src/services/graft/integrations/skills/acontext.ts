/** Acontext integration (Apache-2.0) — https://github.com/memodb-io/Acontext */

export const ACONTEXT_MEMORY_SKILL = `# Acontext skill memory layer

Acontext stores agent learnings as **Markdown skill files** (plain files, no embedding lock-in).

## Philosophy

- Memory = skills on disk (grep, git, edit by hand).
- Progressive disclosure: agent calls \`get_skill\` / \`get_skill_file\` when needed — not semantic top-k dump.
- You design structure in SKILL.md; Acontext distills sessions into that schema.

## Setup (user)

1. Cloud: API key from https://acontext.io (prefix \`sk-ac-\`)
2. Self-host: \`curl -fsSL https://install.acontext.io | sh\` then \`acontext server up\`
3. Install SDK: \`pip install acontext\` or npm \`acontext\` per their docs
4. Full install instructions: https://acontext.io/SKILL.md

## Graft bridge (without full Acontext server)

Until Acontext is configured:

- Use \`/buddy remember <fact>\` for durable bullets
- Use \`.claude/skills/<name>/SKILL.md\` for structured learnings
- After tasks, offer to capture a skill file from what worked/failed

## When Acontext is configured

- Create a learning space + session per project feature
- On task complete/failed, let distillation update skill files per your schema
- On new runs: list skills, fetch only files needed for the current task

## Rules

- Never store secrets in skill memory files.
- Prefer small, named files over one giant memory blob.
- Attribute user corrections explicitly ("User prefers X over Y").
`

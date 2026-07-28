/** Condensed from vibecode-pro-max-kit (MIT) — https://github.com/withkynam/vibecode-pro-max-kit */

export const VIBECODE_RIPER5_SKILL = `# RIPER-5 plan-first workflow (Vibecode)

Do **not** jump to code. Gate each phase; user says "go" between phases unless they enabled autopilot.

## Phases

1. **RESEARCH** — Read-only facts: stack, files, patterns, constraints. No edits.
2. **SPEC** — Plain-language requirements: user stories, acceptance criteria, out-of-scope list.
3. **INNOVATE** — 2-3 approaches with tradeoffs; recommend one.
4. **PLAN** — File-level checklist, risks, test plan. Write to \`process/plans/\` or \`tovyrplan.md\` if no process/ folder.
5. **VALIDATE (PVL)** — Plan validation loop: find gaps in the plan, fix plan, re-check (max 10 cycles). **Hard gate** before EXECUTE.
6. **EXECUTE (EVL)** — Implement plan. After code: run tests independently; if fail, fix and re-run (max 10 cycles).
7. **UPDATE PROCESS** — Capture decisions in \`process/context/\` or Buddy memory; archive the plan.

## Autopilot /goal

When user pastes a /goal block or says "autopilot": run phases sequentially without stopping except:
- Destructive/production actions need confirmation
- Ambiguous requirements — ask once, then continue with stated assumptions
- VALIDATE and post-EXECUTE test verification are **never skipped**

## Model policy

Use cheaper/faster model for research, validation, and docs; reserve strongest model for EXECUTE and subtle bugs.

## Progress persistence

After each phase, append a short progress note to disk (\`process/.progress.md\` or project root) so a new session can resume.
`

export const VIBECODE_GOAL_SKILL = `# /goal run-until-done block (Vibecode)

When the user provides a goal block:

1. Parse target outcome and current phase (default RESEARCH).
2. Execute the current phase fully, write progress to disk.
3. Continue to next phase without asking "should I continue?" unless a hard stop applies.
4. End with: what shipped, what was verified, what remains optional.

Resume phrase for new sessions: "Continue vibecode goal from phase X using process/.progress.md".
`

export const VIBECODE_AUTORESEARCH_SKILL = `# vc-autoresearch loop (Vibecode)

Generic find-gaps → fix → repeat (max 10 iterations):

1. Define artifact (plan, test file, spec, docs).
2. List concrete gaps or failures.
3. Fix highest-severity gap only.
4. Re-audit from scratch.
5. Stop when zero gaps or max iterations.

Use for plan review, test hardening, or spec alignment — not for drive-by refactors.
`

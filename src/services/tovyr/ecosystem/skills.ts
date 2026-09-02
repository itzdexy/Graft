/**
 * Upstream-agent pattern notes.
 *
 * These were once registered as 14 bundled `ecosystem-*` skills. Each carried
 * three or four lines of advice ("Aider-style: use SEARCH/REPLACE blocks"),
 * which put 14 entries into the skill list the model reads every turn. The
 * model duly invoked one and wrote its payload into the user's repository as
 * `ecosystem.md`. Advice that costs context and produces a junk file is worse
 * than no advice, so the skills are gone.
 *
 * The real `/ecosystem` command and the adapters that back working commands
 * (`/improve`, `/recipe`, `/worktree`, …) are unaffected.
 */

/** No blurb skills are registered any more. */
export function listEcosystemSkillIds(): string[] {
  return []
}

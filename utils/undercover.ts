/**
 * Undercover mode — safety utilities for contributing to public/open-source repos.
 *
 * When active, Tovyr strips attribution and adds safety instructions so commits
 * and PRs do not leak internal model names or tooling details.
 *
 * Activation:
 *   - TOVYR_CODE_UNDERCOVER=1 — force ON
 *   - Otherwise AUTO: active unless the repo remote matches the internal
 *     allowlist in commitAttribution.ts. Safe default is ON.
 *
 * Ant-only paths are gated on process.env.USER_TYPE === 'ant'.
 */

import { getRepoClassCached } from './commitAttribution.js'
import { getGlobalConfig } from './config.js'
import { isEnvTruthy } from './envUtils.js'

export function isUndercover(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    if (isEnvTruthy(process.env.TOVYR_CODE_UNDERCOVER)) return true
    return getRepoClassCached() !== 'internal'
  }
  return false
}

export function getUndercoverInstructions(): string {
  if (process.env.USER_TYPE === 'ant') {
    return `## UNDERCOVER MODE — CRITICAL

You are operating in a PUBLIC/OPEN-SOURCE repository. Commit messages, PR titles,
and PR bodies MUST NOT contain internal-only information.

NEVER include in commit messages or PR descriptions:
- Unreleased model version numbers or internal codenames
- Internal repo, project, or tooling names
- Private Slack channels or internal short links
- The phrase "Tovyr" or any mention that you are an AI
- Co-Authored-By lines or other AI attribution

Write commit messages as a human developer would — describe only what the code
change does.
`
  }
  return ''
}

/**
 * Check whether to show the one-time explainer dialog for auto-undercover.
 */
export function shouldShowUndercoverAutoNotice(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    if (isEnvTruthy(process.env.TOVYR_CODE_UNDERCOVER)) return false
    if (!isUndercover()) return false
    if (getGlobalConfig().hasSeenUndercoverAutoNotice) return false
    return true
  }
  return false
}

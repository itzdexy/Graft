import type { PermissionMode } from '../../../types/permissions.js'
import { permissionModeTitle } from '../../../utils/permissions/PermissionMode.js'

export type BlinkPermissionTier =
  | 'read_only'
  | 'auto_edit'
  | 'full_auto'
  | 'yolo'

const TIER_BY_MODE: Partial<Record<PermissionMode, BlinkPermissionTier>> = {
  // Ask mode: auto-accept workspace edits + allowlisted shell (still prompts for risky cmds).
  default: 'auto_edit',
  plan: 'read_only',
  acceptEdits: 'auto_edit',
  auto: 'full_auto',
  bypassPermissions: 'yolo',
}

export function blinkTierForMode(mode: PermissionMode): BlinkPermissionTier {
  return TIER_BY_MODE[mode] ?? 'read_only'
}

/** System prompt section describing Blink permission tiers. */
export function getBlinkPermissionTiersSection(mode: PermissionMode): string {
  const current = permissionModeTitle(mode)
  const tier = blinkTierForMode(mode)

  return [
    '# Blink permission tiers',
    '',
    `Current: **${current}** (${tier}).`,
    '',
    'Tiers (safest → most autonomous):',
    '- **read_only** — `/plan`: research and plan; no file edits without approval.',
    '- **auto_edit** — Ask (default) or `/code`: file edits auto-accepted; allowlisted shell (git, gh, npm, …) auto-runs; other shell still prompts.',
    '- **full_auto** — auto mode (if enabled): broader auto-allow with classifier guards.',
    '- **yolo** — `/bypass`: auto-accept all tools (destructive shell still blocked unless bypass).',
    '',
    'Destructive shell patterns (rm -rf, git push --force, DROP DATABASE, etc.) are blocked in Blink unless bypass is on.',
    'Use `/plan` → `/code` for Plan/Act: draft blinkplan.md first, then implement.',
    tier === 'read_only'
      ? 'In plan/read-only mode you cannot use Write or Edit tools. Do not claim a file was saved unless a write tool succeeded. If the user wants files on disk, tell them to run `/code` or wait for automatic code-mode promotion.'
      : tier === 'auto_edit'
        ? 'In ask/code mode you MUST use Write or Edit to create and change files in the project folder. Never paste full file contents in chat as a substitute for writing to disk — the user expects files saved on disk. Do not use Bash (touch, echo >, etc.) to create files — call Write with file_path and content. Prefer allowlisted shell (git, gh, npm, …); unusual commands will still prompt.'
        : '',
  ]
    .filter(Boolean)
    .join('\n')
}

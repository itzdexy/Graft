import type { PermissionMode } from '../../../types/permissions.js'
import { permissionModeTitle } from '../../../utils/permissions/PermissionMode.js'

export type TovyrPermissionTier =
  | 'read_only'
  | 'auto_edit'
  | 'full_auto'
  | 'yolo'

const TIER_BY_MODE: Partial<Record<PermissionMode, TovyrPermissionTier>> = {
  // Ask mode: auto-accept workspace edits + shell (still prompts for risky cmds).
  default: 'auto_edit',
  plan: 'read_only',
  acceptEdits: 'auto_edit',
  auto: 'full_auto',
  bypassPermissions: 'yolo',
}

export function tovyrTierForMode(mode: PermissionMode): TovyrPermissionTier {
  return TIER_BY_MODE[mode] ?? 'read_only'
}

/** System prompt section describing Tovyr permission tiers. */
export function getTovyrPermissionTiersSection(mode: PermissionMode): string {
  const current = permissionModeTitle(mode)
  const tier = tovyrTierForMode(mode)

  return [
    '# Tovyr permission tiers',
    '',
    `Current: **${current}** (${tier}).`,
    '',
    'Tiers (safest → most autonomous):',
    '- **read_only** — `/plan`: research and plan; no file edits without approval.',
    '- **auto_edit** — Ask (default) or `/code`: file edits auto-accepted; shell runs, except commands that need elevation, reach outside this machine, or change the machine itself.',
    '- **full_auto** — auto mode (if enabled): broader auto-allow with classifier guards.',
    '- **yolo** — `/bypass`: auto-accept all tools (destructive shell still blocked unless bypass).',
    '',
    'Destructive shell patterns (rm -rf, git push --force, DROP DATABASE, etc.) are blocked in Tovyr unless bypass is on.',
    'Use `/plan` → `/code` for Plan/Act: draft tovyrplan.md first, then implement.',
    tier === 'read_only'
      ? 'In plan/read-only mode you cannot use Write or Edit tools. Do not claim a file was saved unless a write tool succeeded. If the user wants files on disk, tell them to run `/code` or wait for automatic code-mode promotion.'
      : tier === 'auto_edit'
        ? 'In ask/code mode you MUST use Write or Edit to create and change files in the project folder. Never paste full file contents in chat as a substitute for writing to disk — the user expects files saved on disk. Do not use Bash (touch, echo >, etc.) to create files — call Write with file_path and content. Ordinary shell runs without asking; sudo, pushes, deploys, and system package changes will prompt.'
        : '',
  ]
    .filter(Boolean)
    .join('\n')
}

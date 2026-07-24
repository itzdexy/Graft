import { randomUUID } from 'node:crypto'

export type OpencodeForkMeta = {
  forkId: string
  parentSessionId?: string
  label: string
  createdAt: string
}

/** OpenCode-style session fork id for /branch experiments. */
export function createOpencodeForkMeta(label: string, parentSessionId?: string): OpencodeForkMeta {
  return {
    forkId: randomUUID(),
    parentSessionId,
    label: label.slice(0, 120),
    createdAt: new Date().toISOString(),
  }
}

export function formatOpencodeForkBanner(meta: OpencodeForkMeta): string {
  return [
    `Fork: ${meta.label}`,
    `forkId: ${meta.forkId}`,
    meta.parentSessionId ? `parent: ${meta.parentSessionId}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatOpencodeHelp(): string {
  return [
    '# OpenCode patterns',
    '',
    '## Session fork & experiments',
    '- `/experiment new <label>` — fork metadata + suggested `experiment/*` git branch',
    '- `/branch` — native conversation branch',
    '',
    '## LSP-aware edits',
    'Set `ENABLE_LSP_TOOL=1` for language-server context on typed languages.',
    '- `/repo analyze` — warm repo map + LSP guidance in system context',
    '',
    '## Command files (IDs)',
    '- `/expansion commands` — `.blink/commands/*.md` with stable ids',
    '',
    '## BMAD workflow',
    '- `/expansion bmad <goal>` — Breakdown → Model → Act → Deliver',
    '',
    '## Multi-model',
    'Switch models per fork via `/model` or `/provider`.',
  ].join('\n')
}

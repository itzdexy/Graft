/**
 * Goose-style Code Mode — minimal context for implementation turns.
 */

import type { PermissionMode } from '../types/permissions.js'

export interface CodeModeContextOptions {
  stripHistory: boolean
  maxHistoryMessages: number
  includeRepoMap: boolean
  includeLsp: boolean
  includeMemory: boolean
}

const DEFAULT_OPTIONS: CodeModeContextOptions = {
  stripHistory: true,
  maxHistoryMessages: 6,
  includeRepoMap: true,
  includeLsp: false,
  includeMemory: true,
}

let options: CodeModeContextOptions = { ...DEFAULT_OPTIONS }

export function getCodeModeContextOptions(): CodeModeContextOptions {
  return { ...options }
}

export function setCodeModeContextOptions(
  patch: Partial<CodeModeContextOptions>,
): CodeModeContextOptions {
  options = { ...options, ...patch }
  return getCodeModeContextOptions()
}

export function isCodeModeActive(mode: PermissionMode): boolean {
  return mode === 'acceptEdits' || mode === 'bypassPermissions'
}

/** Sections to omit from system prompt in code mode for token savings. */
export function codeModeOmitSections(mode: PermissionMode): string[] {
  if (!isCodeModeActive(mode)) return []
  const omit: string[] = []
  if (options.stripHistory) omit.push('verbose_playbook')
  if (!options.includeLsp) omit.push('lsp')
  return omit
}

export function formatCodeModeBanner(mode: PermissionMode): string | null {
  if (!isCodeModeActive(mode)) return null
  return 'Code mode: minimal context · Write/Edit enabled · use tools for all file work'
}

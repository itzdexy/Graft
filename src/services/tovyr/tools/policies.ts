/**
 * User-configurable tool policies (Phase 6).
 * File: ~/.tovyr/tool-policies.json
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getTovyrHome } from '../../../../scripts/tovyr-home.js'
import {
  categoryForToolName,
  getDefaultToolPolicies,
  type ToolCategory,
  type ToolPermission,
} from './framework.js'

export type ToolPoliciesFile = {
  categories?: Partial<Record<ToolCategory, ToolPermission>>
  tools?: Record<string, ToolPermission>
}

const POLICIES_PATH = join(getTovyrHome(), 'tool-policies.json')

let cached: ToolPoliciesFile | null | undefined

export function loadToolPoliciesFile(): ToolPoliciesFile | null {
  if (cached !== undefined) return cached
  if (!existsSync(POLICIES_PATH)) {
    cached = null
    return null
  }
  try {
    cached = JSON.parse(readFileSync(POLICIES_PATH, 'utf8')) as ToolPoliciesFile
    return cached
  } catch {
    cached = null
    return null
  }
}

export function resetToolPoliciesCache(): void {
  cached = undefined
}

export function resolveToolPermission(
  toolName: string,
): ToolPermission | null {
  const file = loadToolPoliciesFile()
  if (!file) return null

  const toolRule = file.tools?.[toolName]
  if (toolRule) return toolRule

  const category = categoryForToolName(toolName)
  const catRule = file.categories?.[category]
  if (catRule) return catRule

  return null
}

export function formatToolPoliciesHelp(): string {
  const defaults = getDefaultToolPolicies()
  return [
    '# Tovyr tool policies',
    '',
    `Optional file: \`${POLICIES_PATH}\``,
    '',
    '```json',
    JSON.stringify(
      {
        categories: Object.fromEntries(
          defaults.map(d => [d.category, d.permission]),
        ),
        tools: { Bash: 'ask', Edit: 'ask' },
      },
      null,
      2,
    ),
    '```',
    '',
    'Permissions: allow | ask | deny — applied before tier gates when set.',
  ].join('\n')
}

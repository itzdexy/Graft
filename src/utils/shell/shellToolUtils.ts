import { BASH_TOOL_NAME } from '../../tools/BashTool/toolName.js'
import { POWERSHELL_TOOL_NAME } from '../../tools/PowerShellTool/toolName.js'
import { isEnvDefinedFalsy } from '../envUtils.js'
import { getPlatform } from '../platform.js'

export const SHELL_TOOL_NAMES: string[] = [BASH_TOOL_NAME, POWERSHELL_TOOL_NAME]

/**
 * Runtime gate for PowerShellTool. Windows-only (the permission engine uses
 * Win32-specific path normalizations), and now ON by default there.
 *
 * It used to be opt-in via GRAFT_CODE_USE_POWERSHELL_TOOL, which left every
 * Windows user with Bash as the only shell. That is not a neutral default: to
 * run a PowerShell one-liner the model had to nest it inside
 * `bash -c "powershell -Command \"...\""`, and bash expands `$_` before
 * PowerShell ever sees it. A `Get-Process | Where-Object { $_.Name ... }`
 * arrives with the variable gone, so the model burns two or three retries
 * rewriting quotes for a command that was correct the first time.
 *
 * Set GRAFT_CODE_USE_POWERSHELL_TOOL=0 to go back to Bash-only.
 *
 * Used by tools.ts (tool-list visibility), processBashCommand (! routing),
 * and promptShellExecution (skill frontmatter routing) so the gate is
 * consistent across all paths that invoke PowerShellTool.call().
 */
export function isPowerShellToolEnabled(): boolean {
  if (getPlatform() !== 'windows') return false
  return !isEnvDefinedFalsy(process.env.GRAFT_CODE_USE_POWERSHELL_TOOL)
}

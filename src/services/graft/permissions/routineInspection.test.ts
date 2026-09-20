import { expect, test } from 'bun:test'
import { isRoutineDirectoryInspection } from './routineInspection.js'
import { getGraftTierToolBlock } from './toolGate.js'
import { hasPermissionsToUseTool } from '../../../utils/permissions/permissions.js'
import { z } from 'zod/v4'

test('directory listings with quoted Windows paths run in plan and default modes', () => {
  const command = 'ls -la "C:\\Users\\example\\New folder\\src"'
  expect(isRoutineDirectoryInspection(command)).toBe(true)
  expect(getGraftTierToolBlock('Bash', 'plan', { command })?.behavior).toBe('allow')
  expect(getGraftTierToolBlock('Bash', 'default', { command })?.behavior).toBe('allow')
  expect(isRoutineDirectoryInspection('Get-ChildItem -LiteralPath "C:\\project\\src"')).toBe(true)
  expect(isRoutineDirectoryInspection('pwd')).toBe(true)
})
test('mutations, compound commands, substitutions, and secret paths are not routine inspections', () => {
  for (const command of ['ls; rm -rf .', 'ls > output.txt', 'ls "$(touch marker)"', 'ls `whoami`', 'ls $HOME', 'dir %PRIVATE%', 'ls ~/.ssh', 'ls .env', 'Get-ChildItem Env:', 'Get-ChildItem Registry::HKEY_CURRENT_USER', 'ls //server/share', 'npm run build', 'rm file', 'ls "unterminated']) {
    expect(isRoutineDirectoryInspection(command)).toBe(false)
  }
  expect(getGraftTierToolBlock('Bash', 'plan', { command: 'npm run build' })?.behavior).toBe('ask')
})

test('the complete permission path allows inspection but retains explicit rules', async () => {
  const tool = { name: 'Bash', inputSchema: z.object({ command: z.string() }), checkPermissions: async () => ({ behavior: 'ask', message: 'Generic shell prompt' }) } as never
  const context = (deny: string[] = [], ask: string[] = []) => ({
    abortController: new AbortController(),
    getAppState: () => ({ toolPermissionContext: { mode: 'plan', alwaysAllowRules: {}, alwaysDenyRules: { localSettings: deny }, alwaysAskRules: { localSettings: ask } } }),
  }) as never
  const input = { command: 'ls -la "C:\\project\\src"' }
  expect((await hasPermissionsToUseTool(tool, input, context(), {} as never, 'inspection-test')).behavior).toBe('allow')
  expect((await hasPermissionsToUseTool(tool, input, context(['Bash']), {} as never, 'inspection-test')).behavior).toBe('deny')
  expect((await hasPermissionsToUseTool(tool, input, context([], ['Bash']), {} as never, 'inspection-test')).behavior).toBe('ask')
})

import { describe, expect, test } from 'bun:test'
import type { ToolPermissionContext } from '../../../Tool.js'
import {
  checkDestructiveShellCommand,
  classifyGraftToolError,
  formatToolInputForLog,
  isCancellationError,
  isRetryableToolError,
  previewFileEditDiff,
  redactSecretsForToolLog,
  validateGraftFileToolPath,
} from './safety.js'

const permissiveCtx: ToolPermissionContext = {
  mode: 'bypassPermissions',
  additionalWorkingDirectories: new Map(),
  alwaysAllowRules: {},
  alwaysDenyRules: {},
  alwaysAskRules: {},
  isBypassPermissionsModeAvailable: true,
}

describe('tool safety — secret redaction', () => {
  test('redacts OpenAI-style API keys', () => {
    const input = 'key=sk-abcdefghijklmnopqrstuvwxyz1234567890'
    expect(redactSecretsForToolLog(input)).not.toContain('abcdefghijklmnopqrstuvwxyz')
    expect(redactSecretsForToolLog(input)).toContain('[REDACTED]')
  })

  test('redacts FreeModel keys', () => {
    const input = 'fe_oa_abcdefghijklmnopqrstuvwxyz123456'
    expect(redactSecretsForToolLog(input)).toContain('[REDACTED]')
    expect(redactSecretsForToolLog(input)).not.toContain('abcdefghijklmnopqrstuvwxyz')
  })

  test('redacts env var assignments in commands', () => {
    const cmd = 'OPENAI_API_KEY=supersecretvalue123 npm test'
    const out = redactSecretsForToolLog(cmd)
    expect(out).toContain('OPENAI_API_KEY=[REDACTED]')
    expect(out).not.toContain('supersecretvalue123')
  })

  test('formatToolInputForLog redacts bearer tokens', () => {
    const log = formatToolInputForLog('Bash', {
      command: 'curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abcdef',
    })
    expect(log).toContain('[REDACTED]')
    expect(log).not.toContain('eyJhbGciOiJIUzI1NiJ9')
  })
})

describe('tool safety — structured errors', () => {
  test('classifies timeout errors', () => {
    const err = classifyGraftToolError(new Error('Command timed out after 120000ms'), 'Bash')
    expect(err.kind).toBe('timeout')
    expect(err.message).toContain('timed out')
  })

  test('classifies cancellation', () => {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    expect(isCancellationError(err)).toBe(true)
    expect(classifyGraftToolError(err, 'Grep').kind).toBe('cancelled')
  })

  test('classifies ENOENT as not_found', () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    expect(classifyGraftToolError(err, 'Read').kind).toBe('not_found')
  })

  test('retryable only for transient errors', () => {
    expect(isRetryableToolError(new Error('ECONNRESET'))).toBe(true)
    expect(isRetryableToolError(new Error('timeout'))).toBe(true)
    expect(isRetryableToolError(new Error('permission denied'))).toBe(false)
    expect(isRetryableToolError(new Error('destructive command blocked'))).toBe(false)
  })
})

describe('tool safety — path validation', () => {
  test('rejects empty path', () => {
    const result = validateGraftFileToolPath('', 'read', '/tmp', permissiveCtx, 'Read')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('path_invalid')
    }
  })

  test('rejects shell expansion in path', () => {
    const result = validateGraftFileToolPath(
      '$HOME/.ssh/id_rsa',
      'read',
      '/tmp',
      permissiveCtx,
      'Read',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('path_denied')
      expect(result.error.message).toContain('Shell expansion')
    }
  })

  test('allows valid relative path', () => {
    const result = validateGraftFileToolPath(
      'src/index.ts',
      'read',
      process.cwd(),
      permissiveCtx,
      'Read',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.resolvedPath).toContain('index.ts')
    }
  })

  test('allows write in bypass mode within project', () => {
    const result = validateGraftFileToolPath(
      'calculator.py',
      'write',
      process.cwd(),
      permissiveCtx,
      'Edit',
    )
    expect(result.ok).toBe(true)
  })

  test('allows write in acceptEdits mode within project', () => {
    const ctx: ToolPermissionContext = {
      ...permissiveCtx,
      mode: 'acceptEdits',
    }
    const result = validateGraftFileToolPath(
      'calculator.py',
      'write',
      process.cwd(),
      ctx,
      'Write',
    )
    expect(result.ok).toBe(true)
  })
})

describe('tool safety — destructive commands', () => {
  test('flags rm -rf', () => {
    const block = checkDestructiveShellCommand('rm -rf ./build')
    expect(block?.kind).toBe('destructive_command')
    expect(block?.message).toContain('recursive force delete')
  })

  test('allows benign commands', () => {
    expect(checkDestructiveShellCommand('npm test')).toBeNull()
  })
})

describe('tool safety — file edit preview', () => {
  test('previewFileEditDiff shows hunks for successful edit', () => {
    const diff = previewFileEditDiff(
      'foo.ts',
      'const x = 1\n',
      'const x = 2\n',
    )
    expect(diff).toContain('@@')
    expect(diff).toContain('-const x = 1')
    expect(diff).toContain('+const x = 2')
  })

  test('previewFileEditDiff reports no changes', () => {
    expect(previewFileEditDiff('a.ts', 'same', 'same')).toBe('(no changes)')
  })
})

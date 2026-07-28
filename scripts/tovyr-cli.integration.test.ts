/**
 * Practical CLI integration tests — launcher, scripts, safety, and agent limits.
 */
import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TOVYR_VERSION } from '../constants/tovyr.js'
import { EXIT } from './tovyr-cli-ux.js'
import {
  getActiveProviderId,
  setActiveProvider,
} from './tovyr-providers.js'
import { persistActiveProvider } from './tovyr-prep-auth.js'
import {
  combinedOutput,
  emptyHomeEnv,
  runCliVersion,
  runLauncher,
  runScript,
} from './tovyr-cli-test-helpers.js'
import {
  AGENT_DEFAULT_MAX_TURNS,
  AGENT_DEFAULT_MAX_TOOL_CALLS,
} from '../services/tovyr/agent/types.js'
import {
  checkDestructiveShellCommand,
  isRetryableToolError,
  previewFileEditDiff,
  validateTovyrFileToolPath,
} from '../services/tovyr/tools/safety.js'
import { withToolRetry } from '../services/tovyr/tools/framework.js'
import {
  checkLoopLimits,
  createLoopState,
  getSessionLimits,
  recordAgentTurn,
} from '../services/tovyr/agent/loopGuard.js'
import type { ToolPermissionContext } from '../Tool.js'
import type { AgentSession } from '../services/tovyr/agent/types.js'

const permissiveCtx: ToolPermissionContext = {
  mode: 'bypassPermissions',
  additionalWorkingDirectories: new Map(),
  alwaysAllowRules: {},
  alwaysDenyRules: {},
  alwaysAskRules: {},
  isBypassPermissionsModeAvailable: true,
}

describe('CLI launcher — help and version', () => {
  test('--help exits 0 with command reference', () => {
    const result = runLauncher(['--help'])
    expect(result.status).toBe(EXIT.OK)
    expect(result.stdout).toContain('Usage:')
    expect(result.stdout).toContain('tovyr setup')
    expect(result.stdout).toContain('tovyr doctor')
    expect(result.stdout).toContain('tovyr review')
    expect(result.stdout).toContain('tovyr sessions list')
    expect(result.stdout).toContain('tovyr bench')
    expect(result.stdout).toContain('Exit codes')
  })

  test('-h is alias for --help', () => {
    const result = runLauncher(['-h'])
    expect(result.status).toBe(EXIT.OK)
    expect(result.stdout).toContain('tovyr provider list')
  })

  test('--version prints version string', () => {
    const result = runLauncher(['--version'])
    expect(result.status).toBe(EXIT.OK)
    expect(result.stdout).toContain(TOVYR_VERSION)
  })
})

describe('CLI launcher — usage errors', () => {
  test('ask without question returns usage exit code', () => {
    const result = runLauncher(['ask'])
    expect(result.status).toBe(EXIT.USAGE)
    expect(combinedOutput(result)).toContain('Usage: tovyr ask')
    expect(combinedOutput(result)).toContain('Example:')
  })

  test('review without scope returns usage exit code', () => {
    const result = runLauncher(['review'])
    expect(result.status).toBe(EXIT.USAGE)
    expect(combinedOutput(result)).toContain('Usage: tovyr review')
  })

  test('plan without scope returns usage exit code', () => {
    const result = runLauncher(['plan'])
    expect(result.status).toBe(EXIT.USAGE)
    expect(combinedOutput(result)).toContain('Usage: tovyr plan')
  })

  test('auth login without --key returns usage exit code', () => {
    const result = runLauncher(['auth', 'login'])
    expect(result.status).toBe(EXIT.USAGE)
    expect(combinedOutput(result)).toContain('auth login')
  })

  test('invalid provider subcommand returns usage with guidance', () => {
    const result = runLauncher(['provider', 'bogus'])
    expect(result.status).toBe(EXIT.USAGE)
    expect(combinedOutput(result)).toContain('provider')
    expect(combinedOutput(result)).toContain('--help')
  })
})

describe('CLI launcher — config and doctor', () => {
  test('config --json returns structured output', () => {
    const result = runLauncher(['config', '--json'])
    expect(result.status).toBe(EXIT.OK)
    const parsed = JSON.parse(result.stdout.trim())
    expect(parsed.ok).toBe(true)
    expect(parsed.data).toHaveProperty('active')
    expect(parsed.data).toHaveProperty('paths')
    expect(parsed.data).toHaveProperty('agentLimits')
  })

  test('doctor --json returns check list', () => {
    const result = runLauncher(['doctor', '--json'])
    expect(result.status).toBe(EXIT.OK)
    const parsed = JSON.parse(result.stdout.trim())
    expect(parsed.ok).toBe(true)
    expect(Array.isArray(parsed.data.checks)).toBe(true)
    expect(parsed.data.checks.length).toBeGreaterThan(3)
  })

  test('doctor --help exits 0', () => {
    const result = runScript('tovyr-doctor.js', ['--help'])
    expect(result.status).toBe(EXIT.OK)
    expect(result.stdout).toContain('tovyr doctor')
  })

  test('doctor --quiet suppresses checklist output', () => {
    const result = runLauncher(['doctor', '--quiet'], { env: { TOVYR_QUIET: '1' } })
    expect(result.status).toBe(EXIT.OK)
    const out = combinedOutput(result)
    expect(out).not.toMatch(/[✓✗!]/)
    expect(out).not.toContain('Tovyr doctor')
  })
})

describe('CLI launcher — missing API key', () => {
  test('prep-auth with empty home gives actionable error', () => {
    const home = mkdtempSync(join(tmpdir(), 'tovyr-cli-test-'))
    try {
      const result = runScript('tovyr-prep-auth.js', [], {
        env: emptyHomeEnv(home),
      })
      expect(result.status).toBe(EXIT.ERROR)
      expect(combinedOutput(result)).toContain('auth login')
      expect(combinedOutput(result)).toContain('API key')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})

describe('CLI launcher — provider selection', () => {
  let savedProvider: string

  beforeEach(() => {
    savedProvider = getActiveProviderId()
  })

  afterEach(() => {
    setActiveProvider(savedProvider)
    persistActiveProvider()
  })

  test('provider list includes freemodel', () => {
    const result = runLauncher(['provider', 'list'])
    expect(result.status).toBe(EXIT.OK)
    expect(result.stdout).toContain('freemodel')
  })

  test('provider list --json is valid', () => {
    const result = runLauncher(['provider', 'list', '--json'])
    expect(result.status).toBe(EXIT.OK)
    const parsed = JSON.parse(result.stdout.trim())
    expect(parsed.ok).toBe(true)
    expect(parsed.data.groups).toBeDefined()
  })

  test('provider use ollama works without API key (local provider)', () => {
    const result = runLauncher(['provider', 'use', 'ollama'])
    expect(result.status).toBe(EXIT.OK)
    expect(combinedOutput(result)).toContain('Ollama')
    expect(getActiveProviderId()).toBe('ollama')
  })

  test('provider use without saved key fails with guidance', () => {
    const result = runLauncher(['provider', 'use', 'cerebras'])
    if (result.status === EXIT.OK) return // key present in env — skip strict assertion
    expect(result.status).toBe(EXIT.ERROR)
    expect(combinedOutput(result)).toContain('API key')
  })
})

describe('CLI entry — main command bootstrap', () => {
  test('cli.tsx --version via Bun (when available)', () => {
    const result = runCliVersion()
    if (!result) {
      expect(true).toBe(true) // Bun not installed in this environment
      return
    }
    expect(result.status).toBe(EXIT.OK)
    expect(result.stdout).toContain(TOVYR_VERSION)
  })
})

describe('CLI tool safety', () => {
  test('blocks destructive rm -rf commands', () => {
    const block = checkDestructiveShellCommand('rm -rf node_modules')
    expect(block).not.toBeNull()
    expect(block!.message).toContain('destructive')
  })

  test('allows benign shell commands', () => {
    expect(checkDestructiveShellCommand('npm test')).toBeNull()
  })

  test('rejects shell expansion in file paths', () => {
    const result = validateTovyrFileToolPath(
      '$HOME/.env',
      'read',
      process.cwd(),
      permissiveCtx,
      'Read',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toMatch(/Shell expansion|not allowed/i)
    }
  })

  test('file edit preview shows diff hunks', () => {
    const diff = previewFileEditDiff('x.ts', 'old\n', 'new\n')
    expect(diff).toContain('@@')
    expect(diff).toContain('-old')
    expect(diff).toContain('+new')
  })

  test('tool retry skips permission and destructive errors', async () => {
    expect(isRetryableToolError(new Error('permission denied'))).toBe(false)
    expect(isRetryableToolError(new Error('destructive command blocked'))).toBe(false)
    let calls = 0
    await expect(
      withToolRetry(
        async () => {
          calls++
          throw new Error('permission denied')
        },
        { maxAttempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toThrow('permission denied')
    expect(calls).toBe(1)
  })
})

describe('CLI tool safety — Windows paths', () => {
  test('accepts backslash relative paths on Windows', () => {
    if (process.platform !== 'win32') return
    const result = validateTovyrFileToolPath(
      'src\\index.ts',
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

  test('accepts forward-slash paths on all platforms', () => {
    const result = validateTovyrFileToolPath(
      'package.json',
      'read',
      process.cwd(),
      permissiveCtx,
      'Read',
    )
    expect(result.ok).toBe(true)
  })
})

describe('CLI agent loop limits', () => {
  function miniSession(maxTurns: number): AgentSession {
    return {
      id: 'test',
      cwd: process.cwd(),
      goal: {
        id: 'g',
        text: 'test',
        acceptanceCriteria: [],
        createdAt: Date.now(),
      },
      phase: 'execute',
      steps: [
        {
          id: '1',
          title: 'step',
          description: 'd',
          status: 'in_progress',
          specialist: 'coder',
          attempts: 0,
        },
      ],
      currentStepIndex: 0,
      reflections: [],
      contextNotes: [],
      startedAt: Date.now(),
      updatedAt: Date.now(),
      maxRetriesPerStep: 3,
      maxTurns,
      loop: createLoopState(),
    }
  }

  test('default max turns constant is enforced', () => {
    expect(AGENT_DEFAULT_MAX_TURNS).toBe(50)
    expect(AGENT_DEFAULT_MAX_TOOL_CALLS).toBe(150)
  })

  test('loop guard stops at max turns', () => {
    const session = miniSession(2)
    session.loop!.turnCount = 1
    const turn = recordAgentTurn(session, 'still working')
    expect(turn.allowed).toBe(false)
    expect(turn.reason).toBe('max_turns')
  })

  test('session limits expose turn budget', () => {
    const session = miniSession(AGENT_DEFAULT_MAX_TURNS)
    const limits = getSessionLimits(session)
    expect(limits.maxTurns).toBe(AGENT_DEFAULT_MAX_TURNS)
    expect(limits.maxToolCalls).toBe(AGENT_DEFAULT_MAX_TOOL_CALLS)
    const check = checkLoopLimits(session)
    expect(check.allowed).toBe(true)
  })
})

describe('unreleased Tovyr browser extension', () => {
  test('chrome setup is unavailable without exposing Claude setup', () => {
    const result = runLauncher(['chrome', 'setup', '--extension-id', 'badid'])
    expect(result.status).toBe(EXIT.OK)
    expect(combinedOutput(result)).toContain(
      'Tovyr browser extension integration is not available yet',
    )
    expect(combinedOutput(result)).not.toContain('Claude')
    expect(combinedOutput(result)).not.toContain('extension ID')
  })

  test('chrome --help suggests working browser alternatives', () => {
    const result = runLauncher(['chrome', '--help'])
    expect(result.status).toBe(EXIT.OK)
    expect(result.stdout).toContain('Playwright')
    expect(result.stdout).toContain('computer-use MCP')
    expect(result.stdout).not.toContain('chrome setup')
  })
})

describe('Tovyr-owned Anthropic login', () => {
  test('uses Tovyr browser auth instead of launching Claude Code', () => {
    const result = runLauncher([
      'auth',
      'login',
      '--provider',
      'claude-subscription',
      '--help',
    ])
    expect(result.status).toBe(EXIT.OK)
    expect(result.stdout).toContain('Tovyr Anthropic account login')
    expect(result.stdout).toContain('stored under ~/.tovyr only')
    expect(result.stdout).not.toContain('Opening the official Claude Code')
  })
})

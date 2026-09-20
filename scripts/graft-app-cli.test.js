import { describe, expect, test } from 'bun:test'
import {
  buildAppModelChoices,
  findActiveAppModelChoice,
  buildCodexLaunchArgs,
  buildChatgptDesktopLaunchArgs,
  desktopComponentMissing,
  parseWindowsAppxExecutable,
  buildClaudeLaunchEnv,
  sanitizeClaudeParentEnv,
  isDirectWindowsExecutable,
  parseAppInvocation,
  resolveLaunchShell,
  main,
} from './graft-app-cli.js'

describe('Graft app launcher', () => {
  test('extracts launcher flags and preserves app arguments', () => {
    expect(
      parseAppInvocation(['codex', '--provider', 'openrouter', '--model', 'openai/gpt-5', 'exec', 'hi']),
    ).toEqual({
      app: 'codex',
      provider: 'openrouter',
      model: 'openai/gpt-5',
      passthrough: ['exec', 'hi'],
    })
  })

  test('reports missing launcher option values instead of silently opening the picker', () => {
    expect(() => parseAppInvocation(['codex', '--provider'])).toThrow(
      'Missing value for --provider',
    )
    expect(() => parseAppInvocation(['codex', '--model', '--no-alt-screen'])).toThrow(
      'Missing value for --model',
    )
  })

  test('builds a qualified Codex model argument', () => {
    expect(buildCodexLaunchArgs('openrouter', 'openai/gpt-5', ['exec', 'hi'])).toEqual([
      '--oss', '--local-provider', 'graft', '-m', 'openrouter::openai/gpt-5',
      '-c', 'notify=[]',
      '-c', 'mcp_servers.hf-mcp-server.enabled=false',
      '-c', 'mcp_servers.mobbin.enabled=false',
      '-c', 'mcp_servers.Roblox_Studio.enabled=false',
      'exec', 'hi',
    ])
  })

  test('launches the desktop Codex view with the selected Graft model', () => {
    expect(
      buildChatgptDesktopLaunchArgs('openrouter::openai/gpt-5', 'C:\\work'),
    ).toEqual([
      'app',
      '-c',
      'model="openrouter::openai/gpt-5"',
      '-c',
      'notify=[]',
      '-c',
      'mcp_servers.hf-mcp-server.enabled=false',
      '-c',
      'mcp_servers.mobbin.enabled=false',
      '-c',
      'mcp_servers.Roblox_Studio.enabled=false',
      'C:\\work',
    ])
  })

  test('does not leave a desktop gateway running when the Codex component is absent', () => {
    expect(desktopComponentMissing('Codex Desktop not found; opening Windows installer...')).toBe(true)
    expect(desktopComponentMissing('Opening workspace C:\\work')).toBe(false)
  })

  test('recognizes the Microsoft Store ChatGPT desktop executable', () => {
    expect(
      parseWindowsAppxExecutable(' C:\\Program Files\\WindowsApps\\OpenAI.Codex_x64\\app\\ChatGPT.exe\r\n'),
    ).toBe('C:\\Program Files\\WindowsApps\\OpenAI.Codex_x64\\app\\ChatGPT.exe')
    expect(parseWindowsAppxExecutable('')).toBeNull()
  })

  test('keeps Codex sessions quiet when optional MCPs are unauthenticated', () => {
    const args = buildCodexLaunchArgs('openrouter', 'openai/gpt-5')
    expect(args).toContain('notify=[]')
    expect(args).toContain('mcp_servers.hf-mcp-server.enabled=false')
    expect(args).toContain('mcp_servers.mobbin.enabled=false')
    expect(args).toContain('mcp_servers.Roblox_Studio.enabled=false')
  })

  test('uses Anthropic-compatible gateway environment for Claude CLI', () => {
    expect(buildClaudeLaunchEnv('secret-token', 'anthropic::claude-sonnet-5')).toEqual({
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:11434',
      ANTHROPIC_API_KEY: 'secret-token',
      ANTHROPIC_MODEL: 'anthropic::claude-sonnet-5',
    })
  })

  test('removes stale Anthropic credentials before Claude uses the gateway', () => {
    expect(
      sanitizeClaudeParentEnv({
        ANTHROPIC_AUTH_TOKEN: 'old-provider-token',
        ANTHROPIC_API_KEY: 'old-api-key',
        ANTHROPIC_BASE_URL: 'https://old.example/v1',
        ANTHROPIC_MODEL: 'old-model',
        PATH: 'path-value',
      }),
    ).toEqual({ PATH: 'path-value' })
  })

  test('deduplicates model choices by qualified identity', () => {
    const choices = buildAppModelChoices([
      { providerId: 'p', providerLabel: 'P', models: [{ id: 'm', label: 'M' }] },
      { providerId: 'p', providerLabel: 'P', models: [{ id: 'm', label: 'M again' }] },
    ])
    expect(choices).toHaveLength(1)
    expect(choices[0].id).toBe('p::m')
  })

  test('resolves the active model for non-interactive launches', () => {
    const choices = buildAppModelChoices([
      { providerId: 'p', providerLabel: 'P', models: [{ id: 'm', label: 'M' }] },
    ])
    expect(findActiveAppModelChoice(choices, 'p', 'm')).toEqual(choices[0])
    expect(findActiveAppModelChoice(choices, 'p', 'missing')).toBeNull()
  })

  test('uses direct spawning for Windows executable clients', () => {
    expect(isDirectWindowsExecutable('codex.exe')).toBe(true)
    expect(isDirectWindowsExecutable('claude.cmd')).toBe(false)
    expect(resolveLaunchShell('codex.exe')).toBe(false)
  })

  test('maps apps status to manager status without a model picker', async () => {
    const calls = []
    const output = []
    const manager = {
      status: async id => { calls.push(['status', id]); return { id, readiness: 'ready' } },
    }
    await main(['apps', 'status', 'codex'], { manager, io: { write: value => output.push(String(value)) } })
    expect(calls).toEqual([['status', 'codex']])
    expect(output.join('')).toContain('readiness')
  })

  test('maps launch aliases through the same manager operation', async () => {
    const calls = []
    const manager = {
      launch: async (id, selection, passthrough) => {
        calls.push({ id, selection, passthrough })
        return { kind: 'manual-setup', appId: id, endpoint: 'http://127.0.0.1:11434/v1' }
      },
    }
    await main(['launch', 'opencode', '--provider', 'openrouter', '--model', 'openai/gpt-5'], {
      manager,
      io: { write: () => {} },
      resolveChoice: async () => ({ id: 'openrouter::openai/gpt-5', providerId: 'openrouter', modelId: 'openai/gpt-5' }),
    })
    expect(calls[0].id).toBe('opencode')
    expect(calls[0].selection.id).toBe('openrouter::openai/gpt-5')
    expect(calls[0].passthrough).toEqual([])
  })
})

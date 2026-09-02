/**
 * Rust core browser harness bridge (Browser Use pattern).
 * Spawns optional native helper when TOVYR_BROWSER_RUST=1.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface RustHarnessSession {
  id: string
  process: ChildProcess | null
  mode: 'native' | 'fallback'
}

const sessions = new Map<string, RustHarnessSession>()

function findRustBinary(): string | null {
  const candidates = [
    process.env.TOVYR_BROWSER_RUST_BIN,
    join(process.cwd(), 'native', 'tovyr-browser', 'target', 'release', 'tovyr-browser'),
    join(process.cwd(), 'native', 'tovyr-browser', 'target', 'debug', 'tovyr-browser'),
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

export async function startRustBrowserHarness(
  sessionId: string,
): Promise<RustHarnessSession> {
  if (sessions.has(sessionId)) return sessions.get(sessionId)!

  const bin = findRustBinary()
  if (!bin || process.env.TOVYR_BROWSER_RUST !== '1') {
    const fallback: RustHarnessSession = {
      id: sessionId,
      process: null,
      mode: 'fallback',
    }
    sessions.set(sessionId, fallback)
    return fallback
  }

  const proc = spawn(bin, ['--session', sessionId], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  })

  const session: RustHarnessSession = {
    id: sessionId,
    process: proc,
    mode: 'native',
  }
  sessions.set(sessionId, session)
  return session
}

export async function rustHarnessNavigate(
  sessionId: string,
  url: string,
): Promise<{ ok: boolean; mode: string; detail?: string }> {
  const s = await startRustBrowserHarness(sessionId)
  if (s.mode === 'fallback') {
    return {
      ok: true,
      mode: 'fallback',
      detail: 'Use Chrome MCP or Playwright MCP (set TOVYR_BROWSER_RUST=1 and build native/tovyr-browser for Rust harness).',
    }
  }
  return new Promise(resolve => {
    const proc = s.process!
    const onData = (buf: Buffer) => {
      if (buf.toString().includes('"ok"')) {
        proc.stdout?.off('data', onData)
        resolve({ ok: true, mode: 'native' })
      }
    }
    proc.stdout?.on('data', onData)
    proc.stdin?.write(JSON.stringify({ action: 'navigate', url }) + '\n')
    setTimeout(() => resolve({ ok: false, mode: 'native', detail: 'timeout' }), 10_000)
  })
}

export function stopRustBrowserHarness(sessionId: string): void {
  const s = sessions.get(sessionId)
  s?.process?.kill()
  sessions.delete(sessionId)
}

export function getRustHarnessStatus(): {
  enabled: boolean
  binaryFound: boolean
  activeSessions: number
} {
  return {
    enabled: process.env.TOVYR_BROWSER_RUST === '1',
    binaryFound: findRustBinary() !== null,
    activeSessions: sessions.size,
  }
}

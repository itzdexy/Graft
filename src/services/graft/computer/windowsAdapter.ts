import { spawn } from 'node:child_process'
import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  releaseComputerUseLock,
  tryAcquireComputerUseLock,
} from '../../../utils/computerUse/computerUseLock.js'
import { getGraftConfigHomeDir } from '../../../utils/envUtils.js'
import type {
  AutomationAction,
  AutomationAdapter,
  AutomationObservation,
  AutomationTarget,
} from '../providers/automation.js'
import {
  graftComputerHostPath,
  getGraftComputerStatus,
  readGraftComputerUseConfig,
} from './state.js'

type HostResponse = {
  ok: boolean
  error?: string
  accessibilityTree?: string
  screenshotBase64?: string
  width?: number
  height?: number
}

function safeAuditAction(action: AutomationAction): Record<string, unknown> {
  if (action.type === 'type' || action.type === 'clipboard_write') {
    return { ...action, text: `[redacted ${action.text.length} chars]` }
  }
  return action
}

async function audit(
  action: AutomationAction,
  outcome: 'success' | 'error' | 'cancelled',
  durationMs: number,
): Promise<void> {
  const dir = join(getGraftConfigHomeDir(), 'computer-use')
  await mkdir(dir, { recursive: true })
  await appendFile(
    join(dir, 'audit.jsonl'),
    `${JSON.stringify({
      at: new Date().toISOString(),
      action: safeAuditAction(action),
      outcome,
      durationMs,
    })}\n`,
    { encoding: 'utf8', mode: 0o600 },
  )
}

function assertAllowedApplication(action: AutomationAction): void {
  const app = action.target.application
  const allowlist = readGraftComputerUseConfig().allowedApps
  if (!app || allowlist.length === 0) return
  if (!allowlist.some(item => item.toLowerCase() === app.toLowerCase())) {
    throw new Error(
      `${app} is not in the Graft computer-use application allowlist.`,
    )
  }
}

async function invokeHost(
  action: AutomationAction,
  signal: AbortSignal,
): Promise<HostResponse> {
  return await new Promise<HostResponse>((resolve, reject) => {
    const child = spawn(graftComputerHostPath(), ['--jsonl'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        GRAFT_COMPUTER_SESSION: process.env.GRAFT_SESSION_ID,
      } as NodeJS.ProcessEnv,
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (error?: Error, response?: HostResponse): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve(response!)
    }
    const abort = (): void => {
      child.kill()
      finish(new DOMException('Computer use stopped', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout = `${stdout}${chunk}`.slice(-2_000_000)
    })
    child.stderr.on('data', chunk => {
      stderr = `${stderr}${chunk}`.slice(-4_000)
    })
    child.on('error', error => finish(error))
    child.on('close', code => {
      if (settled) return
      if (code !== 0) {
        finish(
          new Error(
            stderr.trim() || `graft-computer-host exited with code ${code}.`,
          ),
        )
        return
      }
      try {
        finish(undefined, JSON.parse(stdout.trim()) as HostResponse)
      } catch {
        finish(new Error('graft-computer-host returned malformed JSON.'))
      }
    })
    child.stdin.end(
      `${JSON.stringify({
        protocol: 1,
        action,
        stopKeys: ['Escape', 'Ctrl+C'],
      })}\n`,
    )
  })
}

export class WindowsComputerAutomationAdapter implements AutomationAdapter {
  readonly id = 'graft-computer-host'
  readonly kind = 'desktop' as const

  async isAvailable(): Promise<boolean> {
    return getGraftComputerStatus().ready
  }

  async observe(
    target: AutomationTarget,
    signal: AbortSignal,
  ): Promise<AutomationObservation> {
    const result = await this.act({ type: 'observe', target }, signal)
    if (!result) throw new Error('Computer host returned no observation.')
    return result
  }

  async act(
    action: AutomationAction,
    signal: AbortSignal,
  ): Promise<AutomationObservation | void> {
    const status = getGraftComputerStatus()
    if (!status.ready) throw new Error(status.reason || 'Computer use unavailable.')
    assertAllowedApplication(action)
    const lock = await tryAcquireComputerUseLock()
    if (lock.kind === 'blocked') {
      throw new Error(`Computer use is active in another Graft session (${lock.by}).`)
    }

    const started = Date.now()
    try {
      const result = await invokeHost(action, signal)
      if (!result.ok) throw new Error(result.error || 'Computer host action failed.')
      await audit(action, 'success', Date.now() - started)
      return {
        target: action.target,
        accessibilityTree: result.accessibilityTree,
        screenshotBase64: result.screenshotBase64,
        width: result.width,
        height: result.height,
      }
    } catch (error) {
      await audit(
        action,
        signal.aborted ? 'cancelled' : 'error',
        Date.now() - started,
      )
      throw error
    } finally {
      await releaseComputerUseLock()
    }
  }

  async close(): Promise<void> {
    await releaseComputerUseLock()
  }
}

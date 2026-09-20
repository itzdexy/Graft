/**
 * A real browser for agents, driven over CDP.
 *
 * Launches a Chromium the user already has, in an isolated profile, and
 * exposes the handful of operations an agent needs: go to a page, read what is
 * there, click, type, screenshot. No cloud key, no Playwright download.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CdpSession, parsePageTargets, unwrapEvaluateString } from './cdpClient.js'
import { findChromium } from './chromiumFinder.js'
import { validateBrowserAutomationUrl } from './urlSafety.js'

const DEFAULT_PORT = 9222
const LAUNCH_TIMEOUT_MS = 20_000
const READY_POLL_MS = 250

export type LocalBrowser = {
  session: CdpSession
  close: () => void
}

/**
 * Flags chosen so automation cannot disturb the user's real browsing.
 *
 * A fresh --user-data-dir is the important one: attaching to the user's normal
 * profile would expose their logged-in sessions, cookies and history to the
 * agent, and would also mean a crash could take their windows down with it.
 */
function launchArgs(port: number, profileDir: string): string[] {
  return [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-extensions',
    // Headless by default: an agent browsing should not steal focus or spawn
    // windows over whatever the user is doing.
    '--headless=new',
    '--window-size=1280,900',
    'about:blank',
  ]
}

async function waitForDevTools(
  port: number,
  timeoutMs: number,
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs
  let lastError = 'unknown error'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) return await response.json()
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise(resolve => setTimeout(resolve, READY_POLL_MS))
  }
  throw new Error(`Browser DevTools port ${port} never came up: ${lastError}`)
}

/** Start a browser and attach to its first page. */
export async function launchLocalBrowser(
  port = DEFAULT_PORT,
): Promise<LocalBrowser> {
  const browser = findChromium()
  if (!browser) {
    throw new Error(
      'No Chromium-family browser found. Install Chrome, Edge or Brave, or set GRAFT_BROWSER_PATH to an executable.',
    )
  }

  const profileDir = mkdtempSync(join(tmpdir(), 'graft-browser-'))
  let child: ChildProcess
  try {
    child = spawn(browser.path, launchArgs(port, profileDir), {
      stdio: 'ignore',
      windowsHide: true,
      detached: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to start ${browser.name}: ${message}`)
  }

  try {
    const list = await waitForDevTools(port, LAUNCH_TIMEOUT_MS)
    const targets = parsePageTargets(list)
    const page = targets[0]
    if (!page) {
      throw new Error('Browser started but exposed no page target.')
    }
    const session = new CdpSession(page.webSocketDebuggerUrl)
    await session.connect()
    await session.send('Page.enable')
    await session.send('Runtime.enable')

    return {
      session,
      close: () => {
        session.close()
        child.kill()
      },
    }
  } catch (error) {
    child.kill()
    throw error
  }
}

/** Navigate and wait for the document to finish loading. */
export async function navigate(
  session: CdpSession,
  url: string,
  settleMs = 1_500,
): Promise<void> {
  // Same allowlist/blocklist the cloud browser path uses — a local browser is
  // not a reason to relax where an agent may navigate.
  const verdict = validateBrowserAutomationUrl(url)
  if (!verdict.ok) {
    throw new Error(verdict.reason)
  }

  await session.send('Page.navigate', { url })

  // Poll readyState rather than trusting a fixed sleep: a slow origin would
  // otherwise be read while still blank, and a fast one would waste the wait.
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const state = unwrapEvaluateString(
      await session.send('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      }),
    )
    if (state === 'complete' || state === 'interactive') break
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  // Client-rendered pages finish loading before they finish painting.
  await new Promise(resolve => setTimeout(resolve, settleMs))
}

/** Full serialized DOM after scripts have run. */
export async function readHtml(session: CdpSession): Promise<string> {
  return unwrapEvaluateString(
    await session.send('Runtime.evaluate', {
      expression: 'document.documentElement.outerHTML',
      returnByValue: true,
    }),
  )
}

/** Visible text, which is usually what an agent should reason over. */
export async function readText(session: CdpSession): Promise<string> {
  return unwrapEvaluateString(
    await session.send('Runtime.evaluate', {
      expression: 'document.body ? document.body.innerText : ""',
      returnByValue: true,
    }),
  )
}

export async function currentUrl(session: CdpSession): Promise<string> {
  return unwrapEvaluateString(
    await session.send('Runtime.evaluate', {
      expression: 'location.href',
      returnByValue: true,
    }),
  )
}

/** Base64 PNG of the viewport. */
export async function screenshot(session: CdpSession): Promise<string> {
  const result = await session.send('Page.captureScreenshot', {
    format: 'png',
  })
  return typeof result.data === 'string' ? result.data : ''
}

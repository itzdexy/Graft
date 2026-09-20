import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { z } from 'zod/v4'
import { findChromium } from './chromiumFinder.js'
import { isPrivateBrowserHost } from './urlSafety.js'

export const websiteTestSchema = z.strictObject({
  url: z.string().url().max(2048),
  viewport: z.enum(['desktop', 'mobile']).default('desktop'),
  steps: z.array(z.discriminatedUnion('action', [
    z.strictObject({ action: z.literal('click'), selector: z.string().min(1).max(500) }),
    z.strictObject({ action: z.literal('fill'), selector: z.string().min(1).max(500), value: z.string().max(4000) }),
    z.strictObject({ action: z.literal('press'), selector: z.string().min(1).max(500), key: z.string().min(1).max(80) }),
    z.strictObject({ action: z.literal('expect_text'), text: z.string().min(1).max(1000) }),
    z.strictObject({ action: z.literal('expect_visible'), selector: z.string().min(1).max(500) }),
  ])).max(20).default([]),
})
export type WebsiteTestInput = z.infer<typeof websiteTestSchema>

function loopback(host: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)
}

/** Local development is allowed only at the explicitly requested origin. */
export function validateWebsiteTestUrl(raw: string, approvedOrigin?: string): URL {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP(S) URL without embedded credentials.')
  }
  const local = loopback(url.hostname)
  if (isPrivateBrowserHost(url.hostname) && !(local && (!approvedOrigin || url.origin === approvedOrigin))) {
    throw new Error('Private-network targets are blocked; use an explicit localhost project URL.')
  }
  return url
}

export async function runWebsiteTest(raw: WebsiteTestInput, cwd: string, signal?: AbortSignal) {
  const input = websiteTestSchema.parse(raw)
  const target = validateWebsiteTestUrl(input.url)
  signal?.throwIfAborted()
  const installed = findChromium()
  if (!installed) throw new Error('Install Chrome, Edge, or Chromium, or set GRAFT_BROWSER_PATH to its executable.')
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({ executablePath: installed.path, headless: true, timeout: 20_000 })
  const abort = () => { void browser.close().catch(() => {}) }
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, 90_000)
  const id = randomUUID()
  const artifacts = join(cwd, '.graft', 'browser', id)
  const failures: string[] = []
  const steps: Array<{ action: string; passed: boolean }> = []
  let consoleErrors = 0
  let pageErrors = 0
  let failedRequests = 0
  let status: number | null = null
  let snapshot = ''
  let screenshot: string | undefined
  try {
    signal?.throwIfAborted()
    const context = await browser.newContext({
      viewport: input.viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      serviceWorkers: 'block', acceptDownloads: false,
    })
    context.setDefaultTimeout(5000)
    // Block cross-origin navigation and private subresources, including redirects.
    await context.route('**/*', async route => {
      try {
        const url = validateWebsiteTestUrl(route.request().url(), target.origin)
        if (route.request().isNavigationRequest() && url.origin !== target.origin) return await route.abort('blockedbyclient')
        if (!loopback(url.hostname)) {
          const addresses = await lookup(url.hostname, { all: true })
          if (addresses.some(a => isPrivateBrowserHost(a.address))) return await route.abort('blockedbyclient')
        }
        await route.continue()
      } catch { await route.abort('blockedbyclient').catch(() => {}) }
    })
    const page = await context.newPage()
    page.on('console', message => { if (message.type() === 'error') consoleErrors++ })
    page.on('pageerror', () => { pageErrors++ })
    page.on('requestfailed', () => { failedRequests++ })
    page.on('dialog', dialog => { void dialog.dismiss() })
    context.on('page', popup => { if (popup !== page) void popup.close().catch(() => {}) })
    try {
      const response = await page.goto(target.href, { waitUntil: 'load', timeout: 30_000 })
      status = response?.status() ?? null
      if (status !== null && status >= 400) failures.push(`Navigation returned HTTP ${status}.`)
      for (const step of input.steps) {
        signal?.throwIfAborted()
        try {
          if (step.action === 'click') await page.locator(step.selector).click()
          else if (step.action === 'fill') await page.locator(step.selector).fill(step.value)
          else if (step.action === 'press') await page.locator(step.selector).press(step.key)
          else if (step.action === 'expect_visible') await page.locator(step.selector).waitFor({ state: 'visible' })
          else await page.getByText(step.text, { exact: false }).first().waitFor({ state: 'visible' })
          steps.push({ action: step.action, passed: true })
        } catch {
          steps.push({ action: step.action, passed: false })
          failures.push(`Step ${steps.length} (${step.action}) failed or timed out.`)
          break
        }
      }
    } catch {
      signal?.throwIfAborted()
      failures.push('Page navigation failed or timed out.')
    }
    signal?.throwIfAborted()
    await mkdir(artifacts, { recursive: true })
    snapshot = (await page.locator('body').ariaSnapshot({ timeout: 3000 }).catch(() => '')).slice(0, 12000)
    const capture = join(artifacts, 'screenshot.png')
    try {
      await page.screenshot({ path: capture, timeout: 5000 })
      screenshot = capture
    } catch { failures.push('Screenshot capture failed.') }
    if (consoleErrors || pageErrors || failedRequests) failures.push(`${consoleErrors} console errors, ${pageErrors} page errors, ${failedRequests} failed requests.`)
    const report = { passed: failures.length === 0, status, viewport: input.viewport, steps, failures, consoleErrors, pageErrors, failedRequests, screenshot, snapshot }
    const reportPath = join(artifacts, 'report.json')
    await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 })
    return { ...report, reportPath }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
    await browser.close().catch(() => {})
  }
}

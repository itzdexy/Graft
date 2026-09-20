import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'
import { runWebsiteTest } from '../src/services/graft/browser/websiteTest.js'

const root = await mkdtemp(join(tmpdir(), 'graft-browser-smoke-'))
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  if (new URL(request.url).pathname === '/favicon.ico') return new Response(null, { status: 204 })
  return new Response('<!doctype html><title>Graft test fixture</title><label>Name<input id="name"></label><button id="save" onclick="document.querySelector(\'#result\').textContent=\'Hello \'+document.querySelector(\'#name\').value">Save</button><p id="result"></p>', { headers: { 'Content-Type': 'text/html' } })
} })
try {
  const url = `http://127.0.0.1:${server.port}`
  const result = await runWebsiteTest({ url, viewport: 'mobile', steps: [
    { action: 'fill', selector: '#name', value: 'Graft' },
    { action: 'click', selector: '#save' },
    { action: 'expect_text', text: 'Hello Graft' },
  ] }, root)
  assert.equal(result.passed, true, JSON.stringify(result.failures))
  assert.equal(result.steps.length, 3)
  assert.ok(result.snapshot.includes('Hello Graft'))
  assert.ok(result.screenshot)
  assert.equal((await readFile(result.screenshot!)).subarray(1, 4).toString(), 'PNG')
  const failure = await runWebsiteTest({ url, viewport: 'desktop', steps: [{ action: 'expect_text', text: 'This text does not exist' }] }, root)
  assert.equal(failure.passed, false)
  assert.equal(failure.steps[0]?.passed, false)
  const controller = new AbortController()
  const cancel = setTimeout(() => controller.abort(), 500)
  try {
    await assert.rejects(runWebsiteTest({ url, viewport: 'desktop', steps: [{ action: 'expect_visible', selector: '#never-present' }] }, root, controller.signal))
  } finally { clearTimeout(cancel) }
  const recovered = await runWebsiteTest({ url, viewport: 'desktop', steps: [{ action: 'expect_visible', selector: '#save' }] }, root)
  assert.equal(recovered.passed, true)
  console.log('Browser smoke passed: real Chromium, fill/click/assert, mobile screenshot, and failed-assertion reporting.')
} finally {
  server.stop(true)
  // Only the directory created by mkdtemp above is removed.
  await rm(root, { recursive: true, force: true })
}

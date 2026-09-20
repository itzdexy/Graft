import React from 'react'
import { expect, test } from 'bun:test'
import { renderToText } from '../../test/renderInk.js'
import { GraftActivitySurface } from './GraftActivitySurface.js'
import { GraftLiveActivity } from './GraftLiveActivity.js'
import { ClockContext, type Clock } from '../../ink/components/ClockContext.js'
import { enableConfigs } from '../../utils/config.js'

test('the only activity row drives its own animation clock while waiting for a provider', async () => {
  enableConfigs()
  let now = 0
  const subscribers = new Map<() => void, boolean>()
  const clock: Clock = {
    now: () => now, setTickInterval: () => {},
    subscribe: (callback, keepAlive) => {
      subscribers.set(callback, keepAlive)
      return () => { subscribers.delete(callback) }
    },
  }
  const { lastFrame } = await renderToText(<ClockContext.Provider value={clock}><GraftActivitySurface reducedMotion={false} activity={{
    kind: 'thinking', status: 'active', label: 'Connecting to model',
    startedAt: 0, updatedAt: 0, evidence: [],
  }} /></ClockContext.Provider>, {
    columns: 100, withAppState: true, settleMs: 30,
    env: { NODE_ENV: 'production', CI: '1', GRAFT_FORCE_INTERACTIVE: '1', GRAFT_NO_MOTION: '0' },
    interact: () => {
      if ([...subscribers.values()].some(Boolean)) {
        now = 120
        for (const callback of subscribers.keys()) callback()
      }
    },
  })
  expect(lastFrame).toContain('⠙')
  expect(subscribers.size).toBe(0)
})

test('elapsed time and slow-provider guidance advance even with motion disabled', async () => {
  const { lastFrame } = await renderToText(<GraftLiveActivity
    messages={[]} inProgressToolUseIDs={new Set()} isLoading
    loadingStartTimeRef={{ current: Date.now() - 20000 }} streamMode="requesting"
  />, { columns: 120, withAppState: true, settleMs: 700, env: { GRAFT_NO_MOTION: '1' } })
  expect(lastFrame).toContain('Still no response')
  expect(lastFrame).toMatch(/2[1-9]s/)
  expect(lastFrame).toContain('Esc to stop')
})

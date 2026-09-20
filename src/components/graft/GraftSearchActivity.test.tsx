import React from 'react'
import { expect, test } from 'bun:test'
import { renderToText } from '../../test/renderInk.js'
import { GraftActivitySurface } from './GraftActivitySurface.js'
import type { GraftTurnActivity } from '../../services/graft/dx/turnActivity.js'

const activity: GraftTurnActivity = {
  kind: 'searching', status: 'active', label: 'Search · browser testing',
  startedAt: 0, updatedAt: 0, evidence: [], sourceHosts: ['github.com', 'en.wikipedia.org'],
}
test('search row shows real source badges and fits a narrow terminal', async () => {
  for (const columns of [35, 80]) {
    const { lastFrame } = await renderToText(<GraftActivitySurface activity={activity} reducedMotion />, { columns, withAppState: true })
    expect(lastFrame).toContain('Searching')
    expect(lastFrame).toContain('github.com')
    for (const line of lastFrame.split('\n')) expect([...line].length).toBeLessThanOrEqual(columns)
    if (columns === 80) {
      expect(lastFrame).toContain('2 sources')
      expect(lastFrame).toContain(' G ')
      expect(lastFrame).toContain(' W ')
    }
  }
})

import { describe, expect, test } from 'bun:test'
import {
  createBlinkTipsFeed,
  createBlinkWelcomeFeeds,
} from '../../../components/LogoV2/blinkFeedConfigs.js'

describe('blinkFeedConfigs', () => {
  test('createBlinkTipsFeed has getting-started lines', () => {
    const feed = createBlinkTipsFeed()
    expect(feed.title).toBe('Tips for getting started')
    expect(feed.lines.length).toBeGreaterThanOrEqual(3)
    expect(feed.lines[0]?.text).toContain('/init')
  })

  test('createBlinkWelcomeFeeds is empty without activity or onboarding', () => {
    const feeds = createBlinkWelcomeFeeds([])
    expect(feeds).toEqual([])
  })

  test('createBlinkWelcomeFeeds includes recent activity when present', () => {
    const feeds = createBlinkWelcomeFeeds([
      {
        sessionId: 's1',
        modified: new Date(),
        firstPrompt: 'fix the login bug',
        summary: 'fix the login bug',
        isSidechain: false,
      } as never,
    ])
    expect(feeds.some(f => f.title === 'Recent activity')).toBe(true)
  })
})

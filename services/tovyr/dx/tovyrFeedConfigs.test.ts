import { describe, expect, test } from 'bun:test'
import {
  createTovyrTipsFeed,
  createTovyrWelcomeFeeds,
} from '../../../components/LogoV2/tovyrFeedConfigs.js'

describe('tovyrFeedConfigs', () => {
  test('createTovyrTipsFeed has getting-started lines', () => {
    const feed = createTovyrTipsFeed()
    expect(feed.title).toBe('Tips for getting started')
    expect(feed.lines.length).toBeGreaterThanOrEqual(3)
    expect(feed.lines[0]?.text).toContain('/init')
  })

  test('createTovyrWelcomeFeeds is empty without activity or onboarding', () => {
    const feeds = createTovyrWelcomeFeeds([])
    expect(feeds).toEqual([])
  })

  test('createTovyrWelcomeFeeds includes recent activity when present', () => {
    const feeds = createTovyrWelcomeFeeds([
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

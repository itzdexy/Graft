import { describe, expect, test } from 'bun:test'
import {
  createGraftTipsFeed,
  createGraftWelcomeFeeds,
} from '../../../components/LogoV2/graftFeedConfigs.js'

describe('graftFeedConfigs', () => {
  test('createGraftTipsFeed has getting-started lines', () => {
    const feed = createGraftTipsFeed()
    expect(feed.title).toBe('Tips for getting started')
    expect(feed.lines.length).toBeGreaterThanOrEqual(3)
    expect(feed.lines[0]?.text).toContain('/init')
  })

  test('createGraftWelcomeFeeds is empty without activity or onboarding', () => {
    const feeds = createGraftWelcomeFeeds([])
    expect(feeds).toEqual([])
  })

  test('createGraftWelcomeFeeds includes recent activity when present', () => {
    const feeds = createGraftWelcomeFeeds([
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

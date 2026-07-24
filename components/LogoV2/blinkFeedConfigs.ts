import type { Step } from '../../projectOnboardingState.js'
import type { LogOption } from '../../types/logs.js'
import {
  BlinkQuickStartPanel,
  blinkQuickStartPanelWidth,
} from '../blink/BlinkQuickStartPanel.js'
import type { FeedConfig } from './Feed.js'
import {
  createProjectOnboardingFeed,
  createRecentActivityFeed,
} from './feedConfigs.js'

export { isBlinkRuntime } from '../../utils/blinkRuntime.js'

/** Right-column quick-start panel for Blink welcome layout. */
export function createBlinkQuickStartFeed(): FeedConfig {
  const panelWidth = blinkQuickStartPanelWidth()

  return {
    title: 'Quick start',
    lines: [],
    footer: 'All commands: /guide · PRs: /pr-review',
    emptyMessage: '',
    customContent: {
      content: BlinkQuickStartPanel(),
      width: panelWidth,
    },
  }
}

/** Blink-branded getting-started tips (replaces Claude changelog column). */
export function createBlinkTipsFeed(): FeedConfig {
  return {
    title: 'Tips for getting started',
    lines: [
      { text: 'Run /init to create a blink.md project guide' },
      { text: 'Use /code before asking Blink to edit files' },
      { text: 'Switch models anytime with /model' },
      { text: 'Press ? for keyboard shortcuts' },
    ],
    footer: '/guide for full docs',
  }
}

/** Welcome-screen feeds for Blink — slim; full welcome is BlinkWelcomeScreen. */
export function createBlinkWelcomeFeeds(
  activities: LogOption[],
  onboardingSteps?: Step[],
): FeedConfig[] {
  if (onboardingSteps?.length) {
    return [createProjectOnboardingFeed(onboardingSteps)]
  }
  if (activities.length > 0) {
    return [createRecentActivityFeed(activities)]
  }
  return []
}

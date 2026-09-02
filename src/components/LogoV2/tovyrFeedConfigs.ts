import type { Step } from '../../projectOnboardingState.js'
import type { LogOption } from '../../types/logs.js'
import {
  TovyrQuickStartPanel,
  tovyrQuickStartPanelWidth,
} from '../tovyr/TovyrQuickStartPanel.js'
import type { FeedConfig } from './Feed.js'
import {
  createProjectOnboardingFeed,
  createRecentActivityFeed,
} from './feedConfigs.js'

export { isTovyrRuntime } from '../../utils/tovyrRuntime.js'

/** Right-column quick-start panel for Tovyr welcome layout. */
export function createTovyrQuickStartFeed(): FeedConfig {
  const panelWidth = tovyrQuickStartPanelWidth()

  return {
    title: 'Quick start',
    lines: [],
    footer: 'All commands: /guide · PRs: /pr-review',
    emptyMessage: '',
    customContent: {
      content: TovyrQuickStartPanel(),
      width: panelWidth,
    },
  }
}

/** Tovyr-branded getting-started tips (replaces Tovyr changelog column). */
export function createTovyrTipsFeed(): FeedConfig {
  return {
    title: 'Tips for getting started',
    lines: [
      { text: 'Run /init to create a tovyr.md project guide' },
      { text: 'Use /code before asking Tovyr to edit files' },
      { text: 'Switch models anytime with /model' },
      { text: 'Press ? for keyboard shortcuts' },
    ],
    footer: '/guide for full docs',
  }
}

/** Welcome-screen feeds for Tovyr — slim; full welcome is TovyrWelcomeScreen. */
export function createTovyrWelcomeFeeds(
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

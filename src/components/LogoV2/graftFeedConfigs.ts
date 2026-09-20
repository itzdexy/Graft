import type { Step } from '../../projectOnboardingState.js'
import type { LogOption } from '../../types/logs.js'
import {
  GraftQuickStartPanel,
  graftQuickStartPanelWidth,
} from '../graft/GraftQuickStartPanel.js'
import type { FeedConfig } from './Feed.js'
import {
  createProjectOnboardingFeed,
  createRecentActivityFeed,
} from './feedConfigs.js'

export { isGraftRuntime } from '../../utils/graftRuntime.js'

/** Right-column quick-start panel for Graft welcome layout. */
export function createGraftQuickStartFeed(): FeedConfig {
  const panelWidth = graftQuickStartPanelWidth()

  return {
    title: 'Quick start',
    lines: [],
    footer: 'All commands: /guide · PRs: /pr-review',
    emptyMessage: '',
    customContent: {
      content: GraftQuickStartPanel(),
      width: panelWidth,
    },
  }
}

/** Graft-branded getting-started tips (replaces Graft changelog column). */
export function createGraftTipsFeed(): FeedConfig {
  return {
    title: 'Tips for getting started',
    lines: [
      { text: 'Run /init to create a graft.md project guide' },
      { text: 'Use /code before asking Graft to edit files' },
      { text: 'Switch models anytime with /model' },
      { text: 'Press ? for keyboard shortcuts' },
    ],
    footer: '/guide for full docs',
  }
}

/** Welcome-screen feeds for Graft — slim; full welcome is GraftWelcomeScreen. */
export function createGraftWelcomeFeeds(
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

import * as React from 'react';
import { Text } from '../ink.js';
import { isTovyrWebSubscriber } from '../utils/auth.js';
import { chromeProductName } from '../utils/claudeInChrome/branding.js';
import { TOVYR_CHROME_DOCS_URL } from '../utils/claudeInChrome/kairoExtension.js';
import { isChromeExtensionInstalled, shouldEnableClaudeInChrome } from '../utils/claudeInChrome/setup.js';
import { isRunningOnHomespace } from '../utils/envUtils.js';
import { isTovyrRuntime } from '../utils/tovyrRuntime.js';
import { useStartupNotification } from './notifs/useStartupNotification.js';

const CHROME_EXTENSION_URL = isTovyrRuntime()
  ? TOVYR_CHROME_DOCS_URL
  : 'https://claude.ai/chrome';

function getChromeFlag(): boolean | undefined {
  if (process.argv.includes('--chrome')) {
    return true;
  }
  if (process.argv.includes('--no-chrome')) {
    return false;
  }
  return undefined;
}

export function useChromeExtensionNotification() {
  useStartupNotification(async () => {
    if (isTovyrRuntime()) return null;
    const chromeFlag = getChromeFlag();
    if (!shouldEnableClaudeInChrome(chromeFlag)) {
      return null;
    }

    const product = chromeProductName();
    if (
      !isTovyrRuntime() &&
      process.env.USER_TYPE !== 'ant' &&
      !isTovyrWebSubscriber()
    ) {
      return {
        key: 'chrome-requires-subscription',
        jsx: (
          <Text color="error">
            {product} requires a claude.ai subscription
          </Text>
        ),
        priority: 'immediate' as const,
        timeoutMs: 5000,
      };
    }

    const installed = await isChromeExtensionInstalled();
    if (!installed && !isRunningOnHomespace()) {
      return {
        key: 'chrome-extension-not-detected',
        jsx: (
          <Text color="warning">
            {product} extension not detected · load chrome-extension/ from the
            Tovyr repo or run kairo chrome setup
          </Text>
        ),
        priority: 'immediate' as const,
        timeoutMs: 3000,
      };
    }

    if (chromeFlag === undefined) {
      return {
        key: 'kairo-in-browser-default-enabled',
        text: `${product} enabled · /chrome`,
        priority: 'low' as const,
      };
    }

    return null;
  });
}

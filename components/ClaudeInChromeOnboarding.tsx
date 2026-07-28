import React from 'react'
import { logEvent } from 'src/services/analytics/index.js'
import { Box, Link, Newline, Text, useInput } from '../ink.js'
import { chromeProductName } from '../utils/claudeInChrome/branding.js'
import { TOVYR_CHROME_DOCS_URL } from '../utils/claudeInChrome/kairoExtension.js'
import { isChromeExtensionInstalled } from '../utils/claudeInChrome/setup.js'
import { saveGlobalConfig } from '../utils/config.js'
import { isTovyrRuntime } from '../utils/tovyrRuntime.js'
import { Dialog } from './design-system/Dialog.js'

const CHROME_EXTENSION_URL = isTovyrRuntime()
  ? TOVYR_CHROME_DOCS_URL
  : 'https://claude.ai/chrome'
const CHROME_PERMISSIONS_URL = isTovyrRuntime()
  ? TOVYR_CHROME_DOCS_URL
  : 'https://clau.de/chrome/permissions'
const DOCS_URL = isTovyrRuntime()
  ? TOVYR_CHROME_DOCS_URL
  : 'https://code.claude.com/docs/en/chrome'

type Props = {
  onDone(): void
}

export function ClaudeInChromeOnboarding({ onDone }: Props): React.ReactNode {
  const [isExtensionInstalled, setIsExtensionInstalled] = React.useState(false)
  const productName = chromeProductName()
  const cliName = isTovyrRuntime() ? 'Tovyr Code' : 'Tovyr Code'

  React.useEffect(() => {
    logEvent('tengu_claude_in_chrome_onboarding_shown', {})
    void isChromeExtensionInstalled().then(setIsExtensionInstalled)
    saveGlobalConfig(current => ({
      ...current,
      hasCompletedClaudeInChromeOnboarding: true,
    }))
  }, [])

  useInput((_input, key) => {
    if (key.return) {
      onDone()
    }
  })

  return (
    <Dialog
      title={isTovyrRuntime() ? productName : `${productName} (Beta)`}
      onCancel={onDone}
      color="chromeYellow"
    >
      <Box flexDirection="column" gap={1}>
        <Text>
          {productName} works with the browser extension to let you control your
          browser directly from {cliName}. You can navigate websites, fill forms,
          capture screenshots, record GIFs, and debug with console logs and
          network requests.
          {!isExtensionInstalled && (
            <>
              <Newline />
              <Newline />
              Requires the browser extension. Get started at{' '}
              <Link url={CHROME_EXTENSION_URL} />
            </>
          )}
        </Text>

        <Text dimColor>
          Site-level permissions are inherited from the browser extension.
          Manage permissions in the extension settings to control which sites{' '}
          {isTovyrRuntime() ? 'Tovyr' : 'Claude'} can browse, click, and type on
          {isExtensionInstalled && (
            <>
              {' '}
              (<Link url={CHROME_PERMISSIONS_URL} />)
            </>
          )}
          .
        </Text>

        <Text dimColor>
          For more info, use <Text bold color="chromeYellow">
            /chrome
          </Text>{' '}
          or visit <Link url={DOCS_URL} />
        </Text>
      </Box>
    </Dialog>
  )
}

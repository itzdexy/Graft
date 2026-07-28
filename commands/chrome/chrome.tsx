import React, { useState } from 'react'
import {
  type OptionWithDescription,
  Select,
} from '../../components/CustomSelect/select.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { Box, Text } from '../../ink.js'
import { useAppState } from '../../state/AppState.js'
import { isTovyrWebSubscriber } from '../../utils/auth.js'
import { openBrowser } from '../../utils/browser.js'
import {
  CLAUDE_IN_CHROME_MCP_SERVER_NAME,
  openInChrome,
} from '../../utils/claudeInChrome/common.js'
import { chromeProductName } from '../../utils/claudeInChrome/branding.js'
import { TOVYR_CHROME_DOCS_URL } from '../../utils/claudeInChrome/kairoExtension.js'
import { isChromeExtensionInstalled } from '../../utils/claudeInChrome/setup.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { env } from '../../utils/env.js'
import { isRunningOnHomespace } from '../../utils/envUtils.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'

const isTovyr = isTovyrRuntime()

const CHROME_EXTENSION_URL = isTovyr
  ? TOVYR_CHROME_DOCS_URL
  : 'https://claude.ai/chrome'
const CHROME_PERMISSIONS_URL = isTovyr
  ? TOVYR_CHROME_DOCS_URL
  : 'https://clau.de/chrome/permissions'
const CHROME_RECONNECT_URL = isTovyr
  ? TOVYR_CHROME_DOCS_URL
  : 'https://clau.de/chrome/reconnect'
const DOCS_URL = isTovyr
  ? TOVYR_CHROME_DOCS_URL
  : 'https://code.claude.com/docs/en/chrome'

type MenuAction =
  | 'install-extension'
  | 'reconnect'
  | 'manage-permissions'
  | 'toggle-default'

type Props = {
  onDone: (result?: string) => void
  isExtensionInstalled: boolean
  configEnabled: boolean | undefined
  isTovyrWebSubscriber: boolean
  isWSL: boolean
}

function ChromeMenu({
  onDone,
  isExtensionInstalled: installed,
  configEnabled,
  isTovyrWebSubscriber: isSubscriber,
  isWSL,
}: Props): React.ReactNode {
  const mcpClients = useAppState(s => s.mcp.clients)
  const [selectKey, setSelectKey] = useState(0)
  const [enabledByDefault, setEnabledByDefault] = useState(
    configEnabled ?? false,
  )
  const [showInstallHint, setShowInstallHint] = useState(false)
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(installed)

  const isHomespace =
    process.env.USER_TYPE === 'ant' && isRunningOnHomespace()

  const chromeClient = mcpClients.find(
    c => c.name === CLAUDE_IN_CHROME_MCP_SERVER_NAME,
  )
  const isConnected = chromeClient?.type === 'connected'

  function openUrl(url: string): void {
    if (isHomespace) {
      void openBrowser(url)
    } else {
      void openInChrome(url)
    }
  }

  function handleAction(action: MenuAction): void {
    switch (action) {
      case 'install-extension':
        setSelectKey(k => k + 1)
        setShowInstallHint(true)
        openUrl(CHROME_EXTENSION_URL)
        break
      case 'reconnect':
        setSelectKey(k => k + 1)
        void isChromeExtensionInstalled().then(found => {
          setIsExtensionInstalled(found)
          if (found) setShowInstallHint(false)
        })
        openUrl(CHROME_RECONNECT_URL)
        break
      case 'manage-permissions':
        setSelectKey(k => k + 1)
        openUrl(CHROME_PERMISSIONS_URL)
        break
      case 'toggle-default': {
        const newValue = !enabledByDefault
        saveGlobalConfig(current => ({
          ...current,
          claudeInChromeDefaultEnabled: newValue,
        }))
        setEnabledByDefault(newValue)
        break
      }
    }
  }

  const options: OptionWithDescription<MenuAction>[] = []
  const requiresExtensionSuffix = isExtensionInstalled
    ? ''
    : ' (requires extension)'

  if (!isExtensionInstalled && !isHomespace) {
    options.push({
      label: isTovyr ? 'Install Tovyr in Chrome extension' : 'Install Chrome extension',
      value: 'install-extension',
    })
  }

  options.push(
    {
      label: (
        <>
          <Text>Manage permissions</Text>
          <Text dimColor>{requiresExtensionSuffix}</Text>
        </>
      ),
      value: 'manage-permissions',
    },
    {
      label: (
        <>
          <Text>Reconnect extension</Text>
          <Text dimColor>{requiresExtensionSuffix}</Text>
        </>
      ),
      value: 'reconnect',
    },
    {
      label: `Enabled by default: ${enabledByDefault ? 'Yes' : 'No'}`,
      value: 'toggle-default',
    },
  )

  const isDisabled =
    isWSL ||
    (!isTovyr &&
      process.env.USER_TYPE !== 'ant' &&
      !isSubscriber)

  const productName = chromeProductName()
  const cliName = isTovyr ? 'kairo' : 'claude'

  return (
    <Dialog
      title={`${productName}${isTovyr ? '' : ' (Beta)'}`}
      onCancel={() => onDone()}
      color="chromeYellow"
    >
      <Box flexDirection="column" gap={1}>
        <Text>
          {productName} works with the Chrome extension to let you control your
          browser directly from Tovyr Code.
          Navigate websites, fill forms, capture screenshots, and debug with
          console logs and network requests.
        </Text>

        {isWSL && (
          <Text color="error">
            {productName} is not supported in WSL at this time.
          </Text>
        )}

        {!isTovyr &&
          process.env.USER_TYPE !== 'ant' &&
          !isSubscriber && (
            <Text color="error">
              {productName} requires a claude.ai subscription.
            </Text>
          )}

        {!isDisabled && (
          <>
            {!isHomespace && (
              <Box flexDirection="column">
                <Text>
                  Status:{' '}
                  {isConnected ? (
                    <Text color="success">Enabled</Text>
                  ) : (
                    <Text color="inactive">Disabled</Text>
                  )}
                </Text>
                <Text>
                  Extension:{' '}
                  {isExtensionInstalled ? (
                    <Text color="success">Installed</Text>
                  ) : (
                    <Text color="warning">Not detected</Text>
                  )}
                </Text>
              </Box>
            )}

            <Select
              key={selectKey}
              options={options}
              onChange={handleAction}
              hideIndexes
            />

            {showInstallHint && (
              <Text color="warning">
                Load the unpacked extension from the repo, run{' '}
                <Text>{cliName} chrome setup --extension-id &lt;id&gt;</Text>,
                restart the browser, then select &quot;Reconnect extension&quot;.
              </Text>
            )}

            <Text>
              <Text dimColor>Usage: </Text>
              <Text>
                {cliName} --chrome
              </Text>
              <Text dimColor> or </Text>
              <Text>
                {cliName} --no-chrome
              </Text>
            </Text>

            {isTovyr && (
              <Text dimColor>
                Extension folder: chrome-extension/ in the Tovyr Code repo.
                Register ID: {cliName} chrome setup --extension-id &lt;id&gt;
              </Text>
            )}

            <Text dimColor>
              Site-level permissions are inherited from the Chrome extension.
            </Text>
          </>
        )}

        <Text dimColor>Learn more: {DOCS_URL}</Text>
      </Box>
    </Dialog>
  )
}

export const call = async function (
  onDone: (result?: string) => void,
): Promise<React.ReactNode> {
  const isExtensionInstalled = await isChromeExtensionInstalled()
  const config = getGlobalConfig()
  const isSubscriber = isTovyrWebSubscriber()
  const isWSL = env.isWslEnvironment()

  return (
    <ChromeMenu
      onDone={onDone}
      isExtensionInstalled={isExtensionInstalled}
      configEnabled={config.claudeInChromeDefaultEnabled}
      isTovyrWebSubscriber={isSubscriber}
      isWSL={isWSL}
    />
  )
}

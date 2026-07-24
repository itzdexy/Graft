import * as React from 'react'
import { type ReactNode, useEffect } from 'react'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { Box, Text } from '../../ink.js'
import { useAppState } from '../../state/AppState.js'
import { getEffortSuffix } from '../../utils/effort.js'
import { truncate } from '../../utils/format.js'
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js'
import {
  formatModelAndBilling,
  getBlinkHeaderModelDisplay,
  getLogoDisplayData,
  truncatePath,
} from '../../utils/logoV2Utils.js'
import { renderModelSetting } from '../../utils/model/model.js'
import { OffscreenFreeze } from '../OffscreenFreeze.js'
import { ActivityClawd, resolveClawdMood } from './ActivityClawd.js'
import { AnimatedClawd } from './AnimatedClawd.js'
import { Clawd } from './Clawd.js'
import {
  GuestPassesUpsell,
  incrementGuestPassesSeenCount,
  useShowGuestPassesUpsell,
} from './GuestPassesUpsell.js'
import {
  incrementOverageCreditUpsellSeenCount,
  OverageCreditUpsell,
  useShowOverageCreditUpsell,
} from './OverageCreditUpsell.js'
import { isBlinkRuntime } from './blinkFeedConfigs.js'

type Props = {
  /** True while the model is processing or tools are in flight. */
  isWorking?: boolean
}

export function CondensedLogo({ isWorking = false }: Props): ReactNode {
  const { columns } = useTerminalSize()
  const agent = useAppState(s => s.agent)
  const effortValue = useAppState(s => s.effortValue)
  const permissionMode = useAppState(s => s.toolPermissionContext.mode)
  const model = useMainLoopModel()
  const blink = isBlinkRuntime()
  const clawdMood = resolveClawdMood({
    isWorking,
    permissionMode,
  })
  const modelDisplayName = blink
    ? getBlinkHeaderModelDisplay(model)
    : renderModelSetting(model)
  const {
    version,
    cwd,
    billingType,
    agentName: agentNameFromSettings,
  } = getLogoDisplayData()
  const agentName = agent ?? agentNameFromSettings
  const showGuestPassesUpsell = useShowGuestPassesUpsell()
  const showOverageCreditUpsell = useShowOverageCreditUpsell()

  useEffect(() => {
    if (showGuestPassesUpsell) {
      incrementGuestPassesSeenCount()
    }
  }, [showGuestPassesUpsell])

  useEffect(() => {
    if (showOverageCreditUpsell && !showGuestPassesUpsell) {
      incrementOverageCreditUpsellSeenCount()
    }
  }, [showOverageCreditUpsell, showGuestPassesUpsell])

  const textWidth = Math.max(columns - 15, 20)
  const truncatedVersion = truncate(version, Math.max(textWidth - 13, 6))
  const effortSuffix = getEffortSuffix(model, effortValue)
  const { shouldSplit, truncatedModel, truncatedBilling } =
    formatModelAndBilling(
      modelDisplayName + effortSuffix,
      billingType,
      textWidth,
    )
  const cwdAvailableWidth = agentName
    ? textWidth - 1 - stringWidth(agentName) - 3
    : textWidth
  const truncatedCwd = truncatePath(cwd, Math.max(cwdAvailableWidth, 10))

  const clawd = blink ? (
    <ActivityClawd
      isActive={isWorking}
      mood={clawdMood}
      inline={!isFullscreenEnvEnabled()}
    />
  ) : isFullscreenEnvEnabled() ? (
    <AnimatedClawd />
  ) : (
    <Clawd inline />
  )

  const title = blink ? (
    <Text>
      <Text bold>
        <Text color="#2dd4bf">K</Text>
        <Text color="#22d3ee">a</Text>
        <Text color="#38bdf8">i</Text>
        <Text color="#0ea5e9">r</Text>
        <Text color="#0284c7">o</Text>{' '}
        <Text color="#3b82f6">C</Text>
        <Text color="#6366f1">o</Text>
        <Text color="#818cf8">d</Text>
        <Text color="#a78bfa">e</Text>
      </Text>{' '}
      <Text dimColor>v{truncatedVersion}</Text>
    </Text>
  ) : (
    <Text>
      <Text bold>Blink</Text> <Text dimColor>v{truncatedVersion}</Text>
    </Text>
  )

  const modelLine = blink ? (
    <Box flexDirection="column" gap={0}>
      <Text color="blinkPrimary" dimColor>
        {shouldSplit ? truncatedModel : `${truncatedModel} · ${truncatedBilling}`}
      </Text>
      {shouldSplit ? <Text dimColor>{truncatedBilling}</Text> : null}
    </Box>
  ) : shouldSplit ? (
    <>
      <Text dimColor>{truncatedModel}</Text>
      <Text dimColor>{truncatedBilling}</Text>
    </>
  ) : (
    <Text dimColor>
      {truncatedModel} · {truncatedBilling}
    </Text>
  )

  return (
    <OffscreenFreeze>
      <Box
        borderStyle="round"
        borderColor={blink ? 'blinkPrimary' : 'cyan'}
        borderDimColor
        paddingX={1}
        paddingY={0}
        flexDirection="column"
        width={Math.min(columns, 72)}
      >
        <Box flexDirection="row" gap={2} alignItems="center">
          {clawd}
          <Box flexDirection="column">{title}</Box>
        </Box>
        <Box
          borderStyle="single"
          borderColor="subtle"
          borderDimColor
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          marginY={0}
        />
        <Box flexDirection="column" gap={0}>
          {modelLine}
          <Text dimColor color="subtle">
            {agentName ? (
              <>
                <Text color="blinkPrimary" bold>{'@'}</Text>
                <Text color="text">{agentName}</Text>
                <Text color="subtle">{' · '}</Text>
                <Text>{truncatedCwd}</Text>
              </>
            ) : (
              truncatedCwd
            )}
          </Text>
          {!blink && showGuestPassesUpsell ? <GuestPassesUpsell /> : null}
          {!blink && !showGuestPassesUpsell && showOverageCreditUpsell ? (
            <OverageCreditUpsell maxWidth={textWidth} twoLine />
          ) : null}
        </Box>
      </Box>
    </OffscreenFreeze>
  )
}

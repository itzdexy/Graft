import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import type { OptionWithDescription } from '../CustomSelect/index.js'
import { Select } from '../CustomSelect/index.js'
import { Markdown } from '../Markdown.js'
import { formatCodexApprovalLabel } from '../../services/blink/dx/codexPlanDisplay.js'
import { BlinkCodexPlanPanel } from './BlinkCodexPlanPanel.js'
import { BlinkProjectMapPanel } from './BlinkProjectMapPanel.js'
import { getCwd } from '../../utils/cwd.js'
import { useProjectTaskMap } from '../../hooks/useProjectTaskMap.js'

type Props<T extends string> = {
  planMarkdown: string
  options: OptionWithDescription<T>[]
  onSelect: (value: T) => void
  onCancel: () => void
  onImagePaste?: (content: string, mediaType?: string) => void
  pastedContents?: Array<{ id: string; content: string; mediaType?: string }>
  onRemoveImage?: (id: string) => void
  /** Hide when user already has bypass on — caller should auto-approve instead. */
  showActions?: boolean
}

/**
 * Codex-inspired plan review: checklist, CHECKS strip, summary, Approve / Request changes.
 */
export function BlinkCodeAcceptancePanel<T extends string>({
  planMarkdown,
  options,
  onSelect,
  onCancel,
  onImagePaste,
  pastedContents,
  onRemoveImage,
  showActions = true,
}: Props<T>): ReactNode {
  const codexOptions = options.map(opt =>
    opt.type === 'input'
      ? {
          ...opt,
          label: formatCodexApprovalLabel(opt.label),
          placeholder: opt.placeholder ?? 'What should change?',
        }
      : {
          ...opt,
          label: formatCodexApprovalLabel(opt.label),
        },
  )

  const trimmed = planMarkdown.trim()
  const hasChecklist = trimmed.length > 0
  const projectMap = useProjectTaskMap(getCwd(), trimmed.slice(0, 500))

  return (
    <Box flexDirection="column" width="100%">
      {hasChecklist ? (
        <>
          <BlinkCodexPlanPanel planMarkdown={trimmed} title="Updated Plan" />
          {projectMap.indexed && projectMap.relevantPaths.length > 0 ? (
            <Box paddingX={1} marginBottom={1}>
              <BlinkProjectMapPanel
                map={projectMap}
                width={64}
                variant="panel"
                taskQuery="plan"
              />
            </Box>
          ) : null}
          <Box flexDirection="column" paddingX={1} marginBottom={1}>
            <Text dimColor bold color="blinkPrimary">
              <Text color="blinkPrimary">{'| '}</Text>CHECKS
            </Text>
            <Text dimColor color="subtle">
              <Text color="success" bold>{'> '}</Text>Plan saved to blinkplan.md
            </Text>
            <Text dimColor color="subtle">
              <Text color="warning" bold>{'> '}</Text>Review steps before approving implementation
            </Text>
            <Text dimColor color="subtle">
              <Text color="blinkPrimary" bold>{'> '}</Text>Use <Text color="blinkPrimary" bold>/code</Text> to auto-accept future edits
            </Text>
          </Box>
          <Box
            borderStyle="single"
            borderColor="subtle"
            borderDimColor
            borderLeft={false}
            borderRight={false}
            paddingX={1}
            marginBottom={1}
          >
            <Markdown>{trimmed}</Markdown>
          </Box>
        </>
      ) : null}

      {showActions ? (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <Text dimColor color="subtle">
            <Text color="success" bold>Approve</Text> to implement
            {' · '}
            <Text color="blinkPrimary" bold>Request changes</Text> to keep planning
            {' · '}
            <Text color="error" bold>Esc</Text> to revert
          </Text>
          <Box marginTop={0}>
            <Text dimColor color="subtle">
              <Text color="blinkPrimary" bold>{'> '}</Text>Tip: <Text color="blinkPrimary" bold>/code</Text> mode skips this review step
            </Text>
          </Box>
          <Box marginTop={1}>
            <Select
              options={codexOptions}
              onChange={onSelect}
              onCancel={onCancel}
              onImagePaste={onImagePaste}
              pastedContents={pastedContents}
              onRemoveImage={onRemoveImage}
            />
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}

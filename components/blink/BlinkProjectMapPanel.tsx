import type { ReactNode } from 'react'
import { Box, Text } from '../../ink.js'
import { truncateToWidth } from '../../utils/format.js'
import {
  shortenMapPath,
  type ProjectMapNode,
  type TaskProjectMap,
} from '../../services/blink/repo/taskRelevance.js'

type Props = {
  map: TaskProjectMap
  width?: number
  /** Compact sidebar vs full welcome/plan panel. */
  variant?: 'sidebar' | 'panel'
  taskQuery?: string
}

function MapTreeRow({
  node,
  depth,
  width,
  variant,
}: {
  node: ProjectMapNode
  depth: number
  width: number
  variant: 'sidebar' | 'panel'
}): ReactNode {
  const indent = '  '.repeat(depth)
  const icon = node.isDirectory ? '>' : '*'
  const prefix = `${indent}${icon} `
  const label = truncateToWidth(`${prefix}${node.name}`, width - 2)
  const relevant = node.relevant && !node.isDirectory
  const marker = relevant ? ' *' : ''

  return (
    <Box flexDirection="column">
      <Text
        color={relevant ? 'success' : node.isDirectory ? 'blinkPrimary' : 'text'}
        bold={relevant || node.isDirectory}
        dimColor={!relevant && !node.isDirectory}
        wrap="truncate-end"
      >
        {label}
        {marker ? (
          <Text color="success" bold>{marker}</Text>
        ) : null}
      </Text>
      {node.children.map(child => (
        <MapTreeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          width={width}
          variant={variant}
        />
      ))}
    </Box>
  )
}

/**
 * Codex-style project map: tree of files with task-relevant highlights + import edges.
 */
export function BlinkProjectMapPanel({
  map,
  width = 42,
  variant = 'panel',
  taskQuery,
}: Props): ReactNode {
  const hasRelevant = map.relevantPaths.length > 0
  const compact = variant === 'sidebar'

  return (
    <Box flexDirection="column" width={width} marginY={compact ? 0 : 1}>
      {!compact ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="blinkPrimary">
            <Text color="blinkPrimary">{'| '}</Text>Understands more than the file you opened
          </Text>
          <Text dimColor wrap="wrap">
            Blink maps files, dependencies, and architecture before making changes.
          </Text>
        </Box>
      ) : null}

      <Box flexDirection="column">
        {!compact ? (
          <Text color="blinkPrimary" bold wrap="truncate-end">
            {truncateToWidth(map.rootLabel, width - 2)}
          </Text>
        ) : null}
        {map.tree.length === 0 ? (
          <Text dimColor color="subtle">
            {map.indexed
              ? 'No matches yet'
              : 'Indexing project...'}
          </Text>
        ) : (
          map.tree.map(node => (
            <MapTreeRow
              key={node.path}
              node={node}
              depth={compact ? 0 : 0}
              width={width}
              variant={variant}
            />
          ))
        )}
      </Box>

      {hasRelevant && !compact ? (
        <Box marginTop={1} flexDirection="row" flexWrap="wrap">
          <Text color="success" bold>{'> '}</Text>
          <Text dimColor color="subtle">
            Relevant to task
            {taskQuery ? <Text color="blinkPrimary">{` -- "${truncateToWidth(taskQuery, 28)}"`}</Text> : ''}
          </Text>
        </Box>
      ) : null}

      {map.edges.length > 0 ? (
        <Box flexDirection="column" marginTop={compact ? 1 : 1}>
          {!compact ? (
            <Text dimColor bold color="blinkPrimary">
              <Text color="blinkPrimary">{'| '}</Text>Dependencies
            </Text>
          ) : null}
          {map.edges.map(edge => (
            <Text key={`${edge.from}-${edge.to}`} dimColor wrap="truncate-end">
              <Text color="blinkPrimary">{truncateToWidth(shortenMapPath(edge.from, compact ? 14 : 20), compact ? 14 : 20)}</Text>
              <Text color="subtle"> --&gt; </Text>
              <Text color="text">{truncateToWidth(shortenMapPath(edge.to, compact ? 14 : 20), compact ? 14 : 20)}</Text>
            </Text>
          ))}
        </Box>
      ) : null}

      {!compact && map.indexed ? (
        <Box marginTop={1}>
          <Text dimColor color="subtle">
            <Text color="blinkPrimary" bold>{map.fileCount}</Text> indexed files
          </Text>
        </Box>
      ) : null}
    </Box>
  )
}

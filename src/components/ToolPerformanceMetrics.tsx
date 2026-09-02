/**
 * Tool performance metrics component for tracking and displaying
 * tool execution statistics and performance data.
 */

import React from 'react';
import { Box, Text } from '../ink.js';

export interface ToolMetric {
  toolName: string;
  executionCount: number;
  totalDuration: number; // in ms
  averageDuration: number; // in ms
  successRate: number; // 0-1
  lastExecution?: number; // timestamp
}

type Props = {
  metrics: ToolMetric[];
  showDetails?: boolean;
  sortBy?: 'name' | 'count' | 'duration' | 'success';
  limit?: number;
};

export function ToolPerformanceMetrics({
  metrics,
  showDetails = false,
  sortBy = 'count',
  limit = 10,
}: Props) {
  const sortedMetrics = [...metrics].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.toolName.localeCompare(b.toolName);
      case 'count':
        return b.executionCount - a.executionCount;
      case 'duration':
        return b.totalDuration - a.totalDuration;
      case 'success':
        return b.successRate - a.successRate;
      default:
        return 0;
    }
  });

  const displayMetrics = sortedMetrics.slice(0, limit);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getSuccessColor = (rate: number): string => {
    if (rate >= 0.9) return 'success';
    if (rate >= 0.7) return 'warning';
    return 'error';
  };

  const totalExecutions = metrics.reduce((sum, m) => sum + m.executionCount, 0);
  const totalDuration = metrics.reduce((sum, m) => sum + m.totalDuration, 0);
  const overallSuccessRate = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.successRate * m.executionCount, 0) / totalExecutions
    : 0;

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text bold={true}>Tool Performance Metrics</Text>
        <Text dimColor={true}>({totalExecutions} executions)</Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Box flexDirection="row" gap={2}>
          <Text dimColor={true} width={20}>Tool</Text>
          <Text dimColor={true} width={10} textAlign="right">Count</Text>
          <Text dimColor={true} width={12} textAlign="right">Avg Time</Text>
          <Text dimColor={true} width={12} textAlign="right">Success</Text>
        </Box>
        <Box flexDirection="row">
          <Text dimColor={true}>{'─'.repeat(54)}</Text>
        </Box>

        {displayMetrics.map((metric) => (
          <Box key={metric.toolName} flexDirection="row" gap={2}>
            <Text width={20} color="text">{metric.toolName}</Text>
            <Text width={10} textAlign="right">{metric.executionCount}</Text>
            <Text width={12} textAlign="right">{formatDuration(metric.averageDuration)}</Text>
            <Text 
              width={12} 
              textAlign="right" 
              color={getSuccessColor(metric.successRate)}
            >
              {formatPercentage(metric.successRate)}
            </Text>
          </Box>
        ))}

        {displayMetrics.length === 0 && (
          <Text dimColor={true}>No performance data available</Text>
        )}
      </Box>

      {showDetails && metrics.length > 0 && (
        <Box flexDirection="column" gap={0} marginTop={1}>
          <Text dimColor={true}>Summary:</Text>
          <Box paddingLeft={2}>
            <Text dimColor={true}>
              Total executions: {totalExecutions} | 
              Total time: {formatDuration(totalDuration)} | 
              Overall success: {formatPercentage(overallSuccessRate)}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * Compact performance summary for inline display
 */
export function CompactPerformanceSummary({ metrics }: { metrics: ToolMetric[] }) {
  const totalExecutions = metrics.reduce((sum, m) => sum + m.executionCount, 0);
  const totalDuration = metrics.reduce((sum, m) => sum + m.totalDuration, 0);
  const avgDuration = totalExecutions > 0 ? totalDuration / totalExecutions : 0;

  return (
    <Box flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor={true}>Performance:</Text>
      <Text>{totalExecutions} ops</Text>
      <Text dimColor={true}>|</Text>
      <Text>{avgDuration < 1000 ? `${Math.round(avgDuration)}ms` : `${(avgDuration / 1000).toFixed(1)}s`} avg</Text>
    </Box>
  );
}

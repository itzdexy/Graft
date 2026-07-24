/**
 * Tool execution timeline component for visualizing the sequence of tool calls.
 * Provides a chronological view of tool execution with timing information.
 */

import React from 'react';
import { Box, Text } from '../ink.js';

export interface TimelineEvent {
  id: string;
  toolName: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
}

type Props = {
  events: TimelineEvent[];
  showDetails?: boolean;
  showTiming?: boolean;
  maxEvents?: number;
};

export function ToolExecutionTimeline({
  events,
  showDetails = false,
  showTiming = true,
  maxEvents = 10,
}: Props) {
  const displayEvents = events.slice(-maxEvents);
  const totalDuration = events.reduce((sum, event) => {
    if (event.endTime) {
      return sum + (event.endTime - event.startTime);
    }
    return sum;
  }, 0);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
  };

  const getStatusIcon = (status: TimelineEvent['status']): string => {
    switch (status) {
      case 'pending': return '○';
      case 'running': return '◐';
      case 'completed': return '●';
      case 'error': return '✕';
    }
  };

  const getStatusColor = (status: TimelineEvent['status']): string => {
    switch (status) {
      case 'pending': return 'subtle';
      case 'running': return 'suggestion';
      case 'completed': return 'success';
      case 'error': return 'error';
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text bold={true}>Tool Execution Timeline</Text>
        {showTiming && totalDuration > 0 && (
          <Text dimColor={true}>({formatDuration(totalDuration)} total)</Text>
        )}
      </Box>
      
      {displayEvents.length === 0 ? (
        <Text dimColor={true}>No tool executions yet</Text>
      ) : (
        <Box flexDirection="column" gap={0}>
          {displayEvents.map((event, index) => {
            const duration = event.endTime 
              ? event.endTime - event.startTime 
              : Date.now() - event.startTime;
            
            return (
              <Box key={event.id} flexDirection="column" gap={0}>
                <Box flexDirection="row" alignItems="center" gap={1}>
                  <Text color={getStatusColor(event.status)}>
                    {getStatusIcon(event.status)}
                  </Text>
                  <Text color={event.status === 'running' ? 'text' : 'subtle'}>
                    {event.toolName}
                  </Text>
                  {showTiming && (
                    <Text dimColor={true}>({formatDuration(duration)})</Text>
                  )}
                </Box>
                {showDetails && event.details && (
                  <Box paddingLeft={3}>
                    <Text dimColor={true} italic={true}>
                      {event.details}
                    </Text>
                  </Box>
                )}
                {index < displayEvents.length - 1 && (
                  <Box paddingLeft={1}>
                    <Text dimColor={true}>│</Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/**
 * Compact inline timeline for space-constrained contexts
 */
export function CompactTimeline({ events }: { events: TimelineEvent[] }) {
  const completed = events.filter(e => e.status === 'completed').length;
  const running = events.filter(e => e.status === 'running').length;
  const errors = events.filter(e => e.status === 'error').length;

  return (
    <Box flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor={true}>Timeline:</Text>
      <Text color="success">{completed} ✓</Text>
      {running > 0 && <Text color="suggestion">{running} ◐</Text>}
      {errors > 0 && <Text color="error">{errors} ✕</Text>}
    </Box>
  );
}

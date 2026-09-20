/**
 * Step-by-step progress indicator for multi-stage operations.
 * Provides visual feedback for complex workflows with clear status indicators.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from '../ink.js';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
  details?: string;
  duration?: number; // in ms
}

type Props = {
  steps: Step[];
  currentStep?: string;
  showDetails?: boolean;
  showDuration?: boolean;
};

const STATUS_ICONS: Record<StepStatus, string> = {
  pending: '○',
  in_progress: '◐',
  completed: '●',
  error: '✕',
};

const STATUS_COLORS: Record<StepStatus, string> = {
  pending: 'subtle',
  in_progress: 'suggestion',
  completed: 'success',
  error: 'error',
};

export function StepProgressIndicator({
  steps,
  currentStep,
  showDetails = false,
  showDuration = false,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentStep) {
      const idx = steps.findIndex(s => s.id === currentStep);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [currentStep, steps]);

  const formatDuration = (ms?: number): string => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Box flexDirection="column" gap={1}>
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isPast = index < currentIndex;
        const icon = STATUS_ICONS[step.status];
        const color = STATUS_COLORS[step.status];

        return (
          <Box key={step.id} flexDirection="column" gap={0}>
            <Box flexDirection="row" alignItems="center" gap={1}>
              <Text color={color}>{icon}</Text>
              <Text
                color={isCurrent ? 'text' : isPast ? 'success' : 'subtle'}
                bold={isCurrent}
              >
                {step.label}
              </Text>
              {showDuration && step.duration && (
                <Text dimColor={true}>({formatDuration(step.duration)})</Text>
              )}
            </Box>
            {showDetails && step.details && (
              <Box paddingLeft={3}>
                <Text dimColor={true} italic={true}>
                  {step.details}
                </Text>
              </Box>
            )}
            {isCurrent && step.status === 'in_progress' && (
              <Box paddingLeft={3}>
                <Text dimColor={true}>
                  <Text color="suggestion">{'█'.repeat(3)}</Text>
                  <Text dimColor={true}>{'░'.repeat(7)}</Text>
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Compact inline progress indicator for space-constrained contexts
 */
export function CompactStepProgress({ steps, currentStep }: { steps: Step[]; currentStep?: string }) {
  const currentIndex = currentStep ? steps.findIndex(s => s.id === currentStep) : 0;
  const completed = steps.filter(s => s.status === 'completed').length;
  const total = steps.length;

  return (
    <Box flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor={true}>
        [{completed}/{total}]
      </Text>
      <Text dimColor={true}>
        {'█'.repeat(completed)}
        {'░'.repeat(total - completed)}
      </Text>
      {currentStep && (
        <Text dimColor={true} italic={true}>
          {steps[currentIndex]?.label}
        </Text>
      )}
    </Box>
  );
}

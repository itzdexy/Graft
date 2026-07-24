/**
 * Error recovery suggestions component for providing actionable guidance
 * when tools fail or errors occur during execution.
 */

import React from 'react';
import { Box, Text } from '../ink.js';

export interface ErrorSuggestion {
  title: string;
  description: string;
  action?: string;
  severity: 'low' | 'medium' | 'high';
}

type Props = {
  suggestions: ErrorSuggestion[];
  errorType?: string;
  showActions?: boolean;
};

const SEVERITY_ICONS: Record<ErrorSuggestion['severity'], string> = {
  low: '⚠',
  medium: '⚠',
  high: '✕',
};

const SEVERITY_COLORS: Record<ErrorSuggestion['severity'], string> = {
  low: 'warning',
  medium: 'warning',
  high: 'error',
};

export function ErrorRecoverySuggestions({
  suggestions,
  errorType,
  showActions = true,
}: Props) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" gap={1} marginTop={1}>
      {errorType && (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text color="error" bold={true}>✕</Text>
          <Text color="error" bold={true}>{errorType}</Text>
        </Box>
      )}
      
      <Box flexDirection="column" gap={0}>
        {suggestions.map((suggestion, index) => (
          <Box key={index} flexDirection="column" gap={0} marginBottom={1}>
            <Box flexDirection="row" alignItems="center" gap={1}>
              <Text color={SEVERITY_COLORS[suggestion.severity]}>
                {SEVERITY_ICONS[suggestion.severity]}
              </Text>
              <Text bold={true}>{suggestion.title}</Text>
            </Box>
            <Box paddingLeft={2}>
              <Text dimColor={true}>{suggestion.description}</Text>
            </Box>
            {showActions && suggestion.action && (
              <Box paddingLeft={2}>
                <Text color="suggestion">
                  💡 {suggestion.action}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Common error suggestions for typical tool failures
 */
export function getCommonErrorSuggestions(errorCode?: string): ErrorSuggestion[] {
  const suggestions: ErrorSuggestion[] = [];

  if (!errorCode) {
    return suggestions;
  }

  switch (errorCode) {
    case 'ENOENT':
      suggestions.push({
        title: 'File or directory not found',
        description: 'The specified path does not exist or is not accessible.',
        action: 'Check the file path and ensure it exists. Use relative paths from the current working directory.',
        severity: 'medium',
      });
      break;
    case 'EACCES':
      suggestions.push({
        title: 'Permission denied',
        description: 'You do not have the required permissions to access this resource.',
        action: 'Check file permissions or run with appropriate access rights. Consider using sudo if necessary.',
        severity: 'high',
      });
      break;
    case 'ENOSPC':
      suggestions.push({
        title: 'Disk full',
        description: 'There is no available disk space to complete this operation.',
        action: 'Free up disk space by removing unnecessary files or expanding storage.',
        severity: 'high',
      });
      break;
    case 'ETIMEDOUT':
      suggestions.push({
        title: 'Operation timed out',
        description: 'The operation took too long to complete.',
        action: 'Try again or increase the timeout if available. Check network connectivity.',
        severity: 'medium',
      });
      break;
    case 'ECONNREFUSED':
      suggestions.push({
        title: 'Connection refused',
        description: 'Could not establish a connection to the target server or service.',
        action: 'Verify the service is running and accessible. Check firewall settings.',
        severity: 'high',
      });
      break;
    default:
      suggestions.push({
        title: 'Unexpected error',
        description: 'An unexpected error occurred during tool execution.',
        action: 'Check the error details and try again. If the issue persists, review the logs.',
        severity: 'medium',
      });
  }

  return suggestions;
}

/**
 * Actionable recovery hints for Blink API / stream failures (shown in the REPL).
 */
export function getBlinkApiErrorSuggestions(errorText: string): ErrorSuggestion[] {
  const text = errorText.toLowerCase();
  const suggestions: ErrorSuggestion[] = [];

  if (text.includes('idle timeout') || text.includes('no response for')) {
    suggestions.push({
      title: 'Model took too long to respond',
      description:
        'GPU-backed providers (e.g. NVIDIA NIM) can cold-start 30–90s. Bun’s first compile on Windows can add 1–3 minutes before any network call.',
      action: 'Run `npm run warm` once, try `/model` for a smaller model, or `BLINK_AUTO_FAILOVER=1`.',
      severity: 'high',
    });
  }

  if (text.includes('401') || text.includes('unauthorized') || text.includes('invalid api key')) {
    suggestions.push({
      title: 'Authentication failed',
      description: 'The active provider rejected your API key or token.',
      action: 'Run `blink auth login --key YOUR_KEY` or `/provider` to switch provider.',
      severity: 'high',
    });
  }

  if (text.includes('429') || text.includes('rate limit') || text.includes('too many requests')) {
    suggestions.push({
      title: 'Rate limited',
      description: 'The upstream provider is throttling requests.',
      action: 'Wait a minute, use a smaller model via `/model`, or switch provider with `/provider use`.',
      severity: 'medium',
    });
  }

  if (text.includes('model') && (text.includes('not found') || text.includes('unavailable') || text.includes('does not exist'))) {
    suggestions.push({
      title: 'Model not available',
      description: 'This model is not served by the active provider.',
      action: 'Use `/model` to pick a verified model for your provider.',
      severity: 'high',
    });
  }

  if (text.includes('econnrefused') || text.includes('enotfound') || text.includes('fetch failed')) {
    suggestions.push({
      title: 'Network error',
      description: 'Blink could not reach the provider endpoint.',
      action: 'Check `BLINK_PROVIDER_BASE_URL`, VPN/firewall, and run `blink setup`.',
      severity: 'high',
    });
  }

  if (suggestions.length === 0 && text.length > 0) {
    suggestions.push({
      title: 'Request issue',
      description: 'The provider returned an error before the turn could complete.',
      action: 'Try `/provider`, `/model`, or `blink setup`. Set `BLINK_AUTO_FAILOVER=1` for automatic recovery.',
      severity: 'medium',
    });
  }

  return suggestions;
}

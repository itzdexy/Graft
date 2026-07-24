import { c as _c } from "react/compiler-runtime";
import type { ThinkingBlock, ThinkingBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Box, Text, useAnimationFrame } from '../../ink.js';
import { CtrlOToExpand } from '../CtrlOToExpand.js';
import { Markdown } from '../Markdown.js';
import { useSettings } from '../../hooks/useSettings.js';

type Props = {
  param: ThinkingBlock | ThinkingBlockParam | {
    type: 'thinking';
    thinking: string;
  };
  addMargin: boolean;
  isTranscriptMode: boolean;
  verbose: boolean;
  hideInTranscript?: boolean;
  thinkingStartedAt?: number;
};

const THINKING_FRAMES = ['\u25CB', '\u25D4', '\u25CF', '\u25D0'];

function ThinkingIndicator({ startedAt }: { startedAt?: number }): React.ReactNode {
  const reducedMotion = useSettings().prefersReducedMotion ?? false;
  const [ref, time] = useAnimationFrame(reducedMotion ? null : 80);
  const frame = reducedMotion ? 0 : Math.floor(time / 200) % THINKING_FRAMES.length;
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  return (
    <Box ref={ref} flexDirection="row" alignItems="center" gap={1}>
      <Text color="claude">
        {THINKING_FRAMES[frame]}
      </Text>
      <Text color="claude" bold italic>
        Thinking
      </Text>
      {elapsed > 0 && (
        <Text dimColor>
          {elapsed}s
        </Text>
      )}
    </Box>
  );
}

export function AssistantThinkingMessage(t0) {
  const $ = _c(9);
  const {
    param: t1,
    addMargin: t2,
    isTranscriptMode,
    verbose,
    hideInTranscript: t3,
    thinkingStartedAt,
  } = t0;
  const { thinking } = t1;
  const addMargin = t2 === undefined ? false : t2;
  const hideInTranscript = t3 === undefined ? false : t3;

  if (!thinking) {
    return null;
  }
  if (hideInTranscript) {
    return null;
  }

  const shouldShowFullThinking = isTranscriptMode || verbose;

  if (!shouldShowFullThinking) {
    const t4 = addMargin ? 1 : 0;
    let t5;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
      t5 = (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text dimColor italic>{"\u2234 Thinking"}</Text>
          <CtrlOToExpand />
        </Box>
      );
      $[0] = t5;
    } else {
      t5 = $[0];
    }
    let t6;
    if ($[1] !== t4) {
      t6 = <Box marginTop={t4}>{t5}</Box>;
      $[1] = t4;
      $[2] = t6;
    } else {
      t6 = $[2];
    }
    return t6;
  }

  const t4 = addMargin ? 1 : 0;
  let t5;
  if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
    t5 = (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text color="claude" bold>{"\u2234 Reasoning"}</Text>
        <Text dimColor>Process</Text>
      </Box>
    );
    $[3] = t5;
  } else {
    t5 = $[3];
  }

  let t6;
  if ($[4] !== thinking) {
    t6 = (
      <Box paddingLeft={2} flexDirection="column" gap={1}>
        <Box flexDirection="row" alignItems="center">
          <Text color="claude">\u250C\u2500</Text>
          <Text color="claude"> Analysis</Text>
        </Box>
        <Box paddingLeft={2}>
          <Markdown dimColor={true}>{thinking}</Markdown>
        </Box>
        <Box flexDirection="row" alignItems="center">
          <Text color="claude">\u2514\u2500</Text>
          <Text color="claude"> Complete</Text>
        </Box>
      </Box>
    );
    $[4] = thinking;
    $[5] = t6;
  } else {
    t6 = $[5];
  }

  let t7;
  if ($[6] !== t4 || $[7] !== t6) {
    t7 = (
      <Box flexDirection="column" gap={1} marginTop={t4} width="100%">
        {t5}
        {t6}
      </Box>
    );
    $[6] = t4;
    $[7] = t6;
    $[8] = t7;
  } else {
    t7 = $[8];
  }
  return t7;
}

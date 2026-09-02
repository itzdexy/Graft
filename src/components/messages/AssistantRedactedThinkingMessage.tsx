import { c as _c } from "react/compiler-runtime";
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useAnimationFrame } from '../../ink.js';
import { useSettings } from '../../hooks/useSettings.js';

type Props = {
  addMargin: boolean;
};

const THINKING_FRAMES = ['\u25CB', '\u25D4', '\u25CF', '\u25D0'];

export function AssistantRedactedThinkingMessage(t0) {
  const $ = _c(5);
  const { addMargin: t1 } = t0;
  const addMargin = t1 === undefined ? false : t1;
  const reducedMotion = useSettings().prefersReducedMotion ?? false;
  const [ref, time] = useAnimationFrame(reducedMotion ? null : 80);
  const frame = reducedMotion ? 0 : Math.floor(time / 200) % THINKING_FRAMES.length;
  const t2 = addMargin ? 1 : 0;

  let t3;
  if ($[0] !== frame || $[1] !== reducedMotion) {
    t3 = (
      <Box ref={ref} flexDirection="row" alignItems="center" gap={1}>
        <Text color="claude">
          {THINKING_FRAMES[frame]}
        </Text>
        <Text color="claude" italic>
          Thinking...
        </Text>
      </Box>
    );
    $[0] = frame;
    $[1] = reducedMotion;
    $[2] = t3;
  } else {
    t3 = $[2];
  }

  let t4;
  if ($[3] !== t2 || $[4] !== t3) {
    t4 = <Box marginTop={t2}>{t3}</Box>;
    $[3] = t2;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  return t4;
}

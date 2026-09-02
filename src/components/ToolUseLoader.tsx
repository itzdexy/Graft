import React from 'react'
import { BLACK_CIRCLE } from '../constants/figures.js'
import { useTovyr } from '../hooks/useTovyr.js'
import { Box, Text } from '../ink.js'

type Props = {
  isError: boolean
  isUnresolved: boolean
  shouldAnimate: boolean
}

export function ToolUseLoader({
  isError,
  isUnresolved,
  shouldAnimate,
}: Props): React.ReactNode {
  const [ref, isTovyring] = useTovyr(shouldAnimate)

  const color = isUnresolved ? undefined : isError ? 'error' : 'success'

  // WARNING: The code here and in AssistantToolUseMessage is particularly
  // sensitive to what *should* just be trivial refactoring. A <dim>x</dim>
  // followed *immediately* by <bold>e</bold> tag incorrectly renders `y` as
  // dim! This is because </dim> and </bold> are both reset by \x1b[22m
  // due to historical reasons, and chalk can't distinguish between them.
  // https://github.com/chalk/chalk/issues/290
  return (
    <Box ref={ref} minWidth={2}>
      <Text color={color} dimColor={isUnresolved}>
        {!shouldAnimate || isTovyring || isError || !isUnresolved
          ? BLACK_CIRCLE
          : ' '}
      </Text>
    </Box>
  )
}

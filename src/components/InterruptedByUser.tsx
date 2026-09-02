import * as React from 'react'
import { Text } from '../ink.js'

export function InterruptedByUser(): React.ReactNode {
  return (
    <>
      <Text dimColor>
        Interrupted · resume? [r] / new [n]
      </Text>
    </>
  )
}

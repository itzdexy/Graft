import { expect, test } from 'bun:test'
import * as React from 'react'
import { Box, Text, useInput } from '../../ink.js'
import { useIsModalOverlayActive } from '../../context/overlayContext.js'
import { renderToText } from '../../test-support/renderInk.js'
import { TovyrModelSelector } from './TovyrModelSelector.js'

function ModalHarness() {
  const [open, setOpen] = React.useState(true)
  const [leaks, setLeaks] = React.useState(0)
  const modalActive = useIsModalOverlayActive()
  useInput((_input, key) => {
    if (modalActive) return
    if (key.escape || key.return) setLeaks(count => count + 1)
  })

  return (
    <Box flexDirection="column">
      {open ? (
        <TovyrModelSelector
          onSelect={async () => 'verification failed'}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <Text>{`open:${open} leaks:${leaks}`}</Text>
    </Box>
  )
}

test('model selector registers as a modal so Escape does not leak to the composer', async () => {
  const result = await renderToText(<ModalHarness />, {
    withAppState: true,
    settleMs: 180,
    interact: stdin => stdin.write('\u001b'),
  })

  expect(result.lastFrame).toContain('open:false')
  expect(result.lastFrame).toContain('leaks:0')
})

function FailureHarness() {
  const [attempts, setAttempts] = React.useState(0)
  return (
    <Box flexDirection="column">
      <TovyrModelSelector
        onSelect={async () => {
          setAttempts(count => count + 1)
          return 'verification failed'
        }}
        onClose={() => {}}
      />
      <Text>{`attempts:${attempts}`}</Text>
    </Box>
  )
}

test('Enter awaits activation and exposes its failure without closing the selector', async () => {
  const result = await renderToText(<FailureHarness />, {
    withAppState: true,
    settleMs: 180,
    interact: async stdin => {
      stdin.write('\u001b[B')
      await new Promise(resolve => setTimeout(resolve, 30))
      stdin.write('\r')
    },
  })

  expect(result.lastFrame).toContain('verification failed')
  expect(result.lastFrame).toContain('attempts:1')
})

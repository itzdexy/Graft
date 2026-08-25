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

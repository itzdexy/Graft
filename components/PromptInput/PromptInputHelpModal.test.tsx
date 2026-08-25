import { describe, expect, test } from 'bun:test'
import * as React from 'react'
import { Box, Text, useInput } from '../../ink.js'
import { KeybindingProvider } from '../../keybindings/KeybindingContext.js'
import { DEFAULT_BINDINGS } from '../../keybindings/defaultBindings.js'
import { parseBindings } from '../../keybindings/parser.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import { renderToText } from '../../test-support/renderInk.js'
import { TovyrHelpOverlay } from '../tovyr/TovyrHelpOverlay.js'

function TestKeybindingProvider({ children }: { children: React.ReactNode }) {
  const bindings = React.useMemo(() => parseBindings(DEFAULT_BINDINGS), [])
  const pendingChordRef = React.useRef(null)
  const [pendingChord, setPendingChord] = React.useState(null)
  const activeContexts = React.useRef(new Set()).current
  const handlers = React.useRef(new Map()).current

  return (
    <KeybindingProvider
      bindings={bindings}
      pendingChordRef={pendingChordRef as never}
      pendingChord={pendingChord as never}
      setPendingChord={setPendingChord as never}
      activeContexts={activeContexts as never}
      registerActiveContext={context => activeContexts.add(context)}
      unregisterActiveContext={context => activeContexts.delete(context)}
      handlerRegistryRef={{ current: handlers } as never}
    >
      {children}
    </KeybindingProvider>
  )
}

function HelpModalHarness() {
  const [helpOpen, setHelpOpen] = React.useState(true)
  const [prompt, setPrompt] = React.useState('draft')
  const [submissions, setSubmissions] = React.useState(0)
  const [paletteOpens, setPaletteOpens] = React.useState(0)

  useKeybinding('app:commandPalette', () => setPaletteOpens(count => count + 1), {
    context: 'Global',
    isActive: !helpOpen,
  })
  useInput((input, key) => {
    if (helpOpen) return
    if (key.return) {
      setSubmissions(count => count + 1)
      return
    }
    if (input) setPrompt(value => value + input)
  })

  return (
    <Box flexDirection="column">
      {helpOpen ? <TovyrHelpOverlay onClose={() => setHelpOpen(false)} /> : null}
      <Text>{`closed:${!helpOpen} prompt:${prompt} submit:${submissions} palette:${paletteOpens}`}</Text>
    </Box>
  )
}

describe('PromptInput help modal', () => {
  test('Escape closes help without leaking into the prompt, submission, or palette action', async () => {
    const result = await renderToText(
      <TestKeybindingProvider>
        <HelpModalHarness />
      </TestKeybindingProvider>,
      {
        settleMs: 180,
        interact: stdin => stdin.write('\u001b'),
      },
    )

    expect(result.lastFrame).toContain('closed:true')
    expect(result.lastFrame).toContain('prompt:draft')
    expect(result.lastFrame).toContain('submit:0')
    expect(result.lastFrame).toContain('palette:0')
  })
})

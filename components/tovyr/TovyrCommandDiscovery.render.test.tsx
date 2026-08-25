import { describe, expect, test } from 'bun:test'
import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { KeybindingProvider } from '../../keybindings/KeybindingContext.js'
import { DEFAULT_BINDINGS } from '../../keybindings/defaultBindings.js'
import { parseBindings } from '../../keybindings/parser.js'
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding.js'
import { renderToText } from '../../test-support/renderInk.js'
import type { Command } from '../../types/command.js'
import { TovyrCommandPalette } from './TovyrCommandPalette.js'
import { TovyrHelpOverlay } from './TovyrHelpOverlay.js'
import { TovyrKeyHintBar } from './TovyrKeyHintBar.js'

const modelCommand = {
  type: 'local',
  name: 'model',
  aliases: ['models'],
  description: 'Choose a model',
  supportsNonInteractive: true,
  load: async () => ({ call: async () => ({ type: 'skip' as const }) }),
} as Command

const overrides = [
  { context: 'Global', bindings: { 'ctrl+space': 'app:commandPalette' } },
  { context: 'Chat', bindings: { 'ctrl+shift+m': 'chat:cycleMode' } },
]

function TestKeybindingProvider({
  children,
  overrides: configuredOverrides = overrides,
}: {
  children: React.ReactNode
  overrides?: readonly unknown[]
}) {
  const bindings = React.useMemo(
    () => parseBindings([...DEFAULT_BINDINGS, ...configuredOverrides] as never),
    [configuredOverrides],
  )
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

function CollisionHarness() {
  const [modeCycles, setModeCycles] = React.useState(0)
  const [paletteOpens, setPaletteOpens] = React.useState(0)

  useKeybindings(
    { 'chat:cycleMode': () => setModeCycles(count => count + 1) },
    { context: 'Chat' },
  )
  useKeybinding(
    'app:commandPalette',
    () => setPaletteOpens(count => count + 1),
    { context: 'Global' },
  )

  return (
    <Box flexDirection="column">
      <TovyrHelpOverlay onClose={() => {}} />
      <Text>{`mode:${modeCycles} palette:${paletteOpens}`}</Text>
    </Box>
  )
}

describe('Tovyr command discovery renders', () => {
  test('renders /model, never the legacy plural command', async () => {
    const result = await renderToText(
      React.createElement(TovyrCommandPalette, {
        commands: [modelCommand],
        onClose: () => {},
        onSelect: () => {},
      }),
    )

    expect(result.lastFrame).toContain('/model')
    expect(result.lastFrame).not.toContain('/models')
  })

  test('renders resolved shortcut rows and clips the hint rail by terminal width', async () => {
    const help = await renderToText(
      <TestKeybindingProvider>
        <TovyrHelpOverlay onClose={() => {}} />
      </TestKeybindingProvider>,
      { columns: 100 },
    )
    const wide = await renderToText(
      <TestKeybindingProvider>
        <TovyrKeyHintBar isLoading={false} />
      </TestKeybindingProvider>,
      { columns: 100 },
    )
    const narrow = await renderToText(
      <TestKeybindingProvider>
        <TovyrKeyHintBar isLoading={false} />
      </TestKeybindingProvider>,
      { columns: 30 },
    )

    expect(help.lastFrame).toContain('ctrl+space')
    expect(help.lastFrame).toContain('ctrl+shift+m')
    expect(wide.lastFrame).toContain('ctrl+shift+m')
    expect(narrow.lastFrame).toContain('ctrl+space')
    expect(narrow.lastFrame).not.toContain('ctrl+shift+m')
  })

  test('renders the Windows mode fallback from the active keybinding resolver', async () => {
    const windowsFallback = await renderToText(
      <TestKeybindingProvider
        overrides={[
          { context: 'Chat', bindings: { 'meta+m': 'chat:cycleMode' } },
        ]}
      >
        <TovyrHelpOverlay onClose={() => {}} />
      </TestKeybindingProvider>,
      { columns: 100 },
    )

    expect(windowsFallback.lastFrame).toContain('meta+m')
    expect(windowsFallback.lastFrame).not.toContain('shift+tab')
  })

  test('renders the configured help-dismiss shortcut in the close affordance', async () => {
    const help = await renderToText(
      <TestKeybindingProvider
        overrides={[
          { context: 'Help', bindings: { 'ctrl+q': 'help:dismiss' } },
        ]}
      >
        <TovyrHelpOverlay onClose={() => {}} />
      </TestKeybindingProvider>,
      { columns: 100 },
    )

    expect(help.lastFrame).toContain('ctrl+q to close')
    expect(help.lastFrame).not.toContain('Esc to close')
  })

  test('does not advertise Escape when the active binding explicitly unbinds it', async () => {
    const help = await renderToText(
      <TestKeybindingProvider
        overrides={[{ context: 'Help', bindings: { escape: null } }]}
      >
        <TovyrHelpOverlay onClose={() => {}} />
      </TestKeybindingProvider>,
      { columns: 100 },
    )

    expect(help.lastFrame).not.toContain('Esc')
  })

  test('does not render a nonexistent interrupt hint when Escape is unbound', async () => {
    const hintBar = await renderToText(
      <TestKeybindingProvider
        overrides={[{ context: 'Help', bindings: { escape: null } }]}
      >
        <TovyrKeyHintBar isLoading />
      </TestKeybindingProvider>,
      { columns: 100 },
    )

    expect(hintBar.lastFrame).not.toContain('Esc')
    expect(hintBar.lastFrame).not.toContain('interrupt')
  })

  test('labels Ctrl+P with the Chat action that actually runs after a collision', async () => {
    const result = await renderToText(
      <TestKeybindingProvider
        overrides={[
          { context: 'Chat', bindings: { 'ctrl+p': 'chat:cycleMode' } },
        ]}
      >
        <CollisionHarness />
      </TestKeybindingProvider>,
      {
        settleMs: 180,
        interact: stdin => stdin.write('\u0010'),
      },
    )

    expect(result.lastFrame).toContain('ctrl+p           mode')
    expect(result.lastFrame).not.toContain('ctrl+p           commands')
    expect(result.lastFrame).toContain('mode:1 palette:0')
  })
})

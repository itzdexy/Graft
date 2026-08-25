import { describe, expect, test } from 'bun:test'
import * as React from 'react'
import { KeybindingProvider } from '../../keybindings/KeybindingContext.js'
import { DEFAULT_BINDINGS } from '../../keybindings/defaultBindings.js'
import { parseBindings } from '../../keybindings/parser.js'
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
})

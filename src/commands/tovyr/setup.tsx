import * as React from 'react'
import { useCallback, useState } from 'react'
import type { Command, LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import TextInput from '../../components/TextInput.js'
import { SelectMulti } from '../../components/CustomSelect/SelectMulti.js'
import { TovyrBuddy } from '../../components/LogoV2/TovyrBuddy.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'
import {
  PROVIDER_CATALOG,
  PROVIDER_CATEGORIES,
  getProvider,
  getActiveProviderId,
  getActiveModelId,
  getDefaultModelId,
  isValidKey,
  setProviderKey,
  setActiveProvider,
  setActiveModel,
  loadState,
} from '../../../scripts/tovyr-providers.js'
import {
  applyActiveProviderSession,
  formatProviderAppliedMessage,
} from '../../services/tovyr/applyActiveProvider.js'

type Step = 'welcome' | 'providers' | 'key' | 'summary'
type Saved = { id: string; label: string }

const ACCENT = 'suggestion'

function categoryLabel(cat: string): string {
  return (
    (PROVIDER_CATEGORIES as Record<string, string>)[cat] || cat || 'Provider'
  )
}

/** Modern, sleek bordered frame used by every step. */
function Frame({
  subtitle,
  children,
}: {
  subtitle: string
  children: React.ReactNode
}): React.ReactNode {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={ACCENT} paddingX={2} paddingY={1}>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <TovyrBuddy pose="default" inline />
        <Box flexDirection="column" marginLeft={1}>
          <Text bold color={ACCENT}>
            Tovyr
          </Text>
          <Text dimColor>{subtitle}</Text>
        </Box>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  )
}

function TovyrSetup({
  onDone,
  setAppState,
}: {
  onDone: LocalJSXCommandOnDone
  setAppState?: (f: (prev: import('../../state/AppStateStore.js').AppState) => import('../../state/AppStateStore.js').AppState) => void
}): React.ReactNode {
  const { columns } = useTerminalSize()
  const [step, setStep] = useState<Step>('welcome')
  const [selected, setSelected] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [saved, setSaved] = useState<Saved[]>([])
  const [input, setInput] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [summaryMsg, setSummaryMsg] = useState('')

  useExitOnCtrlCDWithKeybindings()

  // ── Welcome / accept ────────────────────────────────────────────────
  useKeybindings(
    { 'confirm:yes': () => setStep('providers') },
    { context: 'Confirmation', isActive: step === 'welcome' },
  )

  // ── Summary dismiss ─────────────────────────────────────────────────
  useKeybindings(
    { 'confirm:yes': () => onDone(summaryMsg || 'Tovyr setup complete.') },
    { context: 'Confirmation', isActive: step === 'summary' },
  )

  const finish = useCallback(
    async (savedList: Saved[]) => {
      let applied = ''
      if (savedList.length > 0) {
        try {
          // Last configured provider in the wizard becomes the active session default.
          setActiveProvider(savedList[savedList.length - 1].id)
          const active = await applyActiveProviderSession({ setAppState })
          applied = formatProviderAppliedMessage(active)
        } catch (err) {
          applied = err instanceof Error ? err.message : String(err)
        }
      }
      const names = savedList.map(s => s.label).join(', ') || 'none'
      setSummaryMsg(
        `Tovyr setup complete. Connected: ${names}.` +
          (applied ? `\n${applied}` : ''),
      )
      setStep('summary')
    },
    [setAppState],
  )

  const handleProvidersSubmit = useCallback(
    (values: string[]) => {
      if (!values || values.length === 0) {
        void finish([])
        return
      }
      setSelected(values)
      setIdx(0)
      setInput('')
      setCursorOffset(0)
      setError(null)
      setStep('key')
    },
    [finish],
  )

  const advance = useCallback(
    (nextSaved: Saved[]) => {
      const next = idx + 1
      if (next < selected.length) {
        setIdx(next)
        setInput('')
        setCursorOffset(0)
        setError(null)
      } else {
        void finish(nextSaved)
      }
    },
    [idx, selected.length, finish],
  )

  const handleKeySubmit = useCallback(() => {
    const id = selected[idx]
    const def = getProvider(id)
    const trimmed = input.trim()
    // Empty → skip this provider.
    if (!trimmed) {
      advance(saved)
      return
    }
    if (!isValidKey(def, trimmed)) {
      setError(`That doesn't look like a valid key. Expected ${def?.keyHint || 'an API key'}.`)
      return
    }
    setProviderKey(id, trimmed)
    const firstModel = getDefaultModelId(def)
    if (firstModel && !getActiveModelId(id)) setActiveModel(firstModel, id)
    const nextSaved = [...saved, { id, label: def?.label || id }]
    setSaved(nextSaved)
    advance(nextSaved)
  }, [selected, idx, input, saved, advance])

  // ── Render ──────────────────────────────────────────────────────────
  if (step === 'welcome') {
    const count = Object.keys(PROVIDER_CATALOG).length
    return (
      <Frame subtitle="Let's get you connected">
        <Text>
          Connect one or more AI providers, plug in your API keys, and switch
          models anytime.
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>
            • {count} built-in providers + unlimited custom endpoints
          </Text>
          <Text dimColor>
            • Gateways like OpenRouter &amp; Portkey reach thousands of models
          </Text>
          <Text dimColor>• Pick several now — switch instantly later</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="success" bold>
            Press Enter
          </Text>
          <Text dimColor> to choose providers · Ctrl+C to skip</Text>
        </Box>
      </Frame>
    )
  }

  if (step === 'providers') {
    const activeId = getActiveProviderId(loadState())
    const options = Object.values(PROVIDER_CATALOG).map(p => {
      const def = p as (typeof PROVIDER_CATALOG)[string]
      const extra = def.anyModel ? ' · thousands of models' : ''
      return {
        value: def.id,
        label: def.label,
        description: `${categoryLabel(def.category)} · key ${def.keyHint}${extra}`,
      }
    })
    return (
      <Frame subtitle="Step 1 of 2 · Choose your providers">
        <Text dimColor>Space to select · ↑/↓ to move · Enter on Continue when done</Text>
        <Box marginTop={1}>
          <SelectMulti
            options={options}
            defaultValue={PROVIDER_CATALOG[activeId] ? [activeId] : []}
            visibleOptionCount={8}
            submitButtonText="Continue →"
            onSubmit={handleProvidersSubmit}
            onCancel={() => void finish([])}
          />
        </Box>
      </Frame>
    )
  }

  if (step === 'key') {
    const id = selected[idx]
    const def = getProvider(id)
    return (
      <Frame subtitle={`Step 2 of 2 · Plug in your API key (${idx + 1}/${selected.length})`}>
        <Text>
          <Text bold color={ACCENT}>
            {def?.label || id}
          </Text>
          <Text dimColor> — paste your API key</Text>
        </Text>
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor={error ? 'error' : 'subtle'}
          paddingX={1}
        >
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleKeySubmit}
            onPaste={setInput}
            focus
            placeholder={def?.keyHint || 'your-api-key'}
            mask="*"
            columns={columns}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            showCursor
          />
        </Box>
        {error ? (
          <Text color="error">{error}</Text>
        ) : (
          <Text dimColor>
            {def?.signup ? `Get a key: ${def.signup}` : 'Tovyr-compatible endpoint'}
          </Text>
        )}
        <Box marginTop={1}>
          <Text dimColor>Enter to save · leave blank + Enter to skip this one</Text>
        </Box>
      </Frame>
    )
  }

  // summary
  return (
    <Frame subtitle="All set">
      <Text color="success" bold>
        ✓ Setup complete
      </Text>
      <Box marginTop={1} flexDirection="column">
        {saved.length > 0 ? (
          saved.map(s => (
            <Text key={s.id}>
              <Text color="success">● </Text>
              <Text bold>{s.label}</Text>
              <Text dimColor> connected</Text>
            </Text>
          ))
        ) : (
          <Text dimColor>No providers connected — run /tovyr again anytime.</Text>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Switch provider/model: /provider use &lt;id&gt; · /provider model &lt;id&gt;</Text>
        <Text dimColor>Thousands of models on gateways: /provider model &lt;any-id&gt;</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="success" bold>
          Press Enter
        </Text>
        <Text dimColor> to start coding</Text>
      </Box>
    </Frame>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return <TovyrSetup onDone={onDone} setAppState={_context.setAppState} />
}

const setup = {
  type: 'local-jsx',
  name: 'tovyr',
  aliases: ['setup', 'connect'],
  description: 'Tovyr — connect AI providers and plug in your API keys',
  load: () => import('./setup.js'),
} satisfies Command

export default setup

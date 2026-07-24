import * as React from 'react'
import { useCallback, useState } from 'react'
import type { Command, LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { Select } from '../../components/CustomSelect/select.js'
import TextInput from '../../components/TextInput.js'
import { BlinkBuddy } from '../../components/LogoV2/BlinkBuddy.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings.js'
import { renderToString } from '../../utils/staticRender.js'
import {
  PROVIDER_CATALOG,
  PROVIDER_CATEGORIES,
  getActiveProviderId,
  getActiveModelId,
  getProvider,
  isValidKey,
  loadState,
  listProviderIds,
  listProviderCategoriesOrdered,
  isMediaProviderCategory,
  getDefaultModelId,
  setActiveProvider,
  setActiveModel,
  setProviderKey,
  setCustomProvider,
} from '../../scripts/blink-providers.js'
import {
  applyActiveProviderSession,
  formatProviderAppliedMessage,
} from '../../services/blink/applyActiveProvider.js'
import { getCachedProviderModelIds } from '../../services/blink/providerModels.js'
import { validateModelForProvider } from '../../services/blink/validateProviderModel.js'

const ACCENT = 'suggestion'
const DONE_VALUE = '__done__'

function categoryLabel(cat: string): string {
  return (PROVIDER_CATEGORIES as Record<string, string>)[cat] || cat || 'Provider'
}

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
        <BlinkBuddy pose="default" inline />
        <Box flexDirection="column" marginLeft={1}>
          <Text bold color={ACCENT}>
            Blink
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

function ProviderFlow({
  onDone,
  setAppState,
}: {
  onDone: LocalJSXCommandOnDone
  setAppState?: (f: (prev: import('../../state/AppStateStore.js').AppState) => import('../../state/AppStateStore.js').AppState) => void
}): React.ReactNode {
  const { columns } = useTerminalSize()
  const [step, setStep] = useState<'menu' | 'key'>('menu')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useExitOnCtrlCDWithKeybindings(() => onDone('', { display: 'skip' }))

  const finishWithProvider = useCallback(
    async (id: string, key: string) => {
      const def = getProvider(id)
      const trimmed = key.trim()
      if (trimmed) {
        setProviderKey(id, trimmed)
      }
      setActiveProvider(id)
      const latest = loadState()
      const existingModel = getActiveModelId(id, latest)
      if (!existingModel) {
        const firstModel = getDefaultModelId(def)
        if (firstModel) setActiveModel(firstModel, id)
      }

      let message = trimmed
        ? `Saved API key for ${def?.label || id}.`
        : `Active provider → ${def?.label || id}.`

      try {
        const active = await applyActiveProviderSession({ setAppState })
        const verified = getCachedProviderModelIds()
        message += `\n${formatProviderAppliedMessage(active, verified?.length)}`
      } catch (err) {
        message += `\n${err instanceof Error ? err.message : String(err)}`
      }

      onDone(message)
    },
    [onDone, setAppState],
  )

  const handleKeySubmit = useCallback(() => {
    if (!selectedId) return
    const def = getProvider(selectedId)
    const trimmed = input.trim()
    const state = loadState()
    const existingKey = state.keys?.[selectedId] || ''

    if (!trimmed) {
      if (!isValidKey(def, existingKey)) {
        setError(`API key required. Expected ${def?.keyHint || 'an API key'}.`)
        return
      }
      void finishWithProvider(selectedId, existingKey)
      return
    }

    if (!isValidKey(def, trimmed)) {
      setError(`That doesn't look like a valid key. Expected ${def?.keyHint || 'an API key'}.`)
      return
    }

    void finishWithProvider(selectedId, trimmed)
  }, [selectedId, input, finishWithProvider])

  if (step === 'key' && selectedId) {
    const def = getProvider(selectedId)
    return (
      <Frame subtitle={`API key · ${def?.label || selectedId}`}>
        <Text>
          Paste your API key for <Text bold>{def?.label || selectedId}</Text>
        </Text>
        <Box marginTop={1} borderStyle="round" borderColor={error ? 'error' : 'secondaryText'} paddingX={1}>
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
          <Text dimColor>{def?.signup ? `Get a key: ${def.signup}` : 'Blink-compatible endpoint'}</Text>
        )}
        <Box marginTop={1}>
          <Text dimColor>Enter to save · Ctrl+C to cancel</Text>
        </Box>
      </Frame>
    )
  }

  const state = loadState()
  const activeId = getActiveProviderId(state)
  const activeDef = getProvider(activeId, state)
  const activeModel = getActiveModelId(activeId, state)
  const activeModelLabel =
    activeDef?.models.find(m => m.id === activeModel)?.label || activeModel

  const options: Array<{
    value: string
    label: string
    description?: string
    disabled?: boolean
  }> = []

  for (const category of listProviderCategoriesOrdered()) {
    options.push({
      value: `__header_${category.id}`,
      label: `— ${category.label} —`,
      disabled: true,
    })
    for (const entry of category.providers) {
      const hasKey = isValidKey(getProvider(entry.id, state), state.keys?.[entry.id] || '')
      const isActive = entry.id === activeId
      const extra = entry.anyModel ? ' · any model id' : ''
      const mediaNote = isMediaProviderCategory(entry.category) ? ' · reference only' : ''
      options.push({
        value: entry.id,
        label: `${isActive ? '● ' : ''}${entry.label}`,
        description: `${entry.keyHint}${hasKey ? ' ✓ key' : ''}${extra}${mediaNote}`,
      })
    }
  }

  options.push({
    value: DONE_VALUE,
    label: 'Done',
    description: 'Return to chat without changing provider',
  })

  return (
    <Frame subtitle={`Providers · ${listProviderIds().length} supported`}>
      <Text dimColor>
        Active: <Text color="success">{activeDef?.label || activeId}</Text>
        {activeModelLabel ? (
          <>
            {' '}
            · <Text>{activeModelLabel}</Text>
          </>
        ) : null}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>↑/↓ to move · Enter to choose a provider</Text>
      </Box>
      <Box marginTop={1}>
        <Select
          options={options}
          defaultFocusValue={activeId}
          visibleOptionCount={14}
          layout="compact-vertical"
          onChange={(value: string) => {
            if (value === DONE_VALUE) {
              onDone('', { display: 'skip' })
              return
            }
            if (value.startsWith('__header_')) return
            const def = getProvider(value)
            if (def && isMediaProviderCategory(def.category)) {
              onDone(
                `${def.label} is a ${categoryLabel(def.category)} — not a chat LLM. Pick a gateway or API provider above for coding.`,
              )
              return
            }
            const latest = loadState()
            const savedKey = latest.keys?.[value] || ''
            if (isValidKey(def, savedKey)) {
              void finishWithProvider(value, savedKey)
              return
            }
            setSelectedId(value)
            setInput('')
            setCursorOffset(0)
            setError(null)
            setStep('key')
          }}
          onCancel={() => onDone('', { display: 'skip' })}
        />
      </Box>
    </Frame>
  )
}

function ProviderCard(message?: string): React.ReactNode {
  const state = loadState()
  const activeId = getActiveProviderId(state)
  const activeDef = getProvider(activeId, state)
  const activeModel = getActiveModelId(activeId, state)

  return (
    <Frame subtitle="Providers & Models">
      {message ? <Text color="success">{message}</Text> : null}
      <Text>
        Active: <Text bold>{activeDef?.label || activeId}</Text>
        {activeModel ? <Text dimColor> · {activeModel}</Text> : null}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>/provider — interactive provider picker</Text>
        <Text dimColor>/model — pick a model for connected providers</Text>
        <Text dimColor>/provider use &lt;id&gt; · /provider model &lt;id&gt; · /provider key &lt;key&gt;</Text>
      </Box>
    </Frame>
  )
}

async function emitStatic(
  onDone: LocalJSXCommandOnDone,
  node: React.ReactNode,
  result?: string,
): Promise<React.ReactNode> {
  const text = await renderToString(node)
  onDone(result ?? text)
  return node
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const sub = (parts[0] || '').toLowerCase()

  async function applyAndShow(successLine: string): Promise<React.ReactNode> {
    try {
      const active = await applyActiveProviderSession({
        setAppState: _context.setAppState,
      })
      const verified = getCachedProviderModelIds()
      const applied = formatProviderAppliedMessage(active, verified?.length)
      const node = ProviderCard(applied)
      return emitStatic(onDone, node, `${successLine}\n${applied}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const node = ProviderCard(msg)
      return emitStatic(onDone, node, msg)
    }
  }

  try {
    if (sub === 'list') {
      const node = ProviderCard()
      return emitStatic(onDone, node)
    }

    if (sub === 'use' && parts[1]) {
      const id = parts[1].toLowerCase()
      if (!PROVIDER_CATALOG[id]) {
        const node = ProviderCard(
          `Unknown provider "${id}". Run /provider for all ${listProviderIds().length} providers.`,
        )
        return emitStatic(onDone, node)
      }
      setActiveProvider(id)
      return applyAndShow(`Active provider → ${PROVIDER_CATALOG[id].label}.`)
    }

    if (sub === 'model' && parts[1]) {
      const providerId = getActiveProviderId()
      const modelId = parts[1]
      const validation = await validateModelForProvider(providerId, modelId, {
        forceFetch: true,
      })
      if (!validation.ok) {
        const msg = validation.suggestion
          ? `${validation.message}\n\nSuggested: ${validation.suggestion}`
          : validation.message
        const node = ProviderCard(msg)
        return emitStatic(onDone, node, msg)
      }
      setActiveModel(validation.model, providerId)
      const normalized =
        validation.corrected && validation.notice ? ` (${validation.notice})` : ''
      return applyAndShow(`Active model → ${validation.model}${normalized}.`)
    }

    if (sub === 'key' && parts.length >= 2) {
      let id = getActiveProviderId()
      let key = parts[1]
      if (parts.length >= 3 && PROVIDER_CATALOG[parts[1].toLowerCase()]) {
        id = parts[1].toLowerCase()
        key = parts[2]
      }
      const def = getProvider(id)
      if (!isValidKey(def, key)) {
        const node = ProviderCard(`Invalid key for ${def?.label}. Expected ${def?.keyHint}.`)
        return emitStatic(onDone, node)
      }
      setProviderKey(id, key)
      setActiveProvider(id)
      return applyAndShow(`Saved key for ${def?.label} and made it active.`)
    }

    if ((sub === 'url' || sub === 'custom') && parts[1]) {
      let id = getActiveProviderId()
      let url = parts[1]
      if (parts.length >= 3 && PROVIDER_CATALOG[parts[1].toLowerCase()]) {
        id = parts[1].toLowerCase()
        url = parts[2]
      }
      setCustomProvider({ baseUrl: url, providerId: id })
      if (id !== getActiveProviderId()) setActiveProvider(id)
      return applyAndShow(`Endpoint for ${PROVIDER_CATALOG[id]?.label || id} → ${url}.`)
    }
  } catch (err) {
    const node = ProviderCard(err instanceof Error ? err.message : String(err))
    return emitStatic(onDone, node)
  }

  return <ProviderFlow onDone={onDone} setAppState={_context.setAppState} />
}

const provider = {
  type: 'local-jsx',
  name: 'provider',
  description: 'Blink — connect AI providers and switch models',
  argumentHint: '[use <id> | model <id> | key <key> | url <id> <url> | list]',
  load: () => import('./provider.js'),
} satisfies Command

export default provider

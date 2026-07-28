import * as React from 'react'
import { useCallback, useState } from 'react'
import type { Command, LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { Select } from '../../components/CustomSelect/select.js'
import TextInput from '../../components/TextInput.js'
import { Spinner } from '../../components/Spinner.js'
import { ConsoleOAuthFlow } from '../../components/ConsoleOAuthFlow.js'
import { TovyrProviderModelPicker } from '../../components/tovyr/TovyrProviderModelPicker.js'
import { TovyrBuddy } from '../../components/LogoV2/TovyrBuddy.js'
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
  setProviderAuth,
  setCustomProvider,
} from '../../scripts/tovyr-providers.js'
import {
  applyActiveProviderSession,
  formatProviderAppliedMessage,
} from '../../services/tovyr/applyActiveProvider.js'
import { getCachedProviderModelIds } from '../../services/tovyr/providerModels.js'
import { validateModelForProvider } from '../../services/tovyr/validateProviderModel.js'
import {
  getOfficialProviderLogin,
  verifyProviderApiKey,
} from '../../services/tovyr/providerSetup.js'
import { isLocalProvider } from '../../scripts/tovyr-provider-local.js'
import { CodexAccountLogin } from '../../components/tovyr/CodexAccountLogin.js'
import {
  formatProviderConnectionSnapshot,
  probeActiveProviderConnection,
} from '../../services/tovyr/providers/probe.js'

const ACCENT = 'suggestion'
const DONE_VALUE = '__done__'
const SEARCH_VALUE = '__search__'
const API_KEY_VALUE = '__api_key__'
const OFFICIAL_LOGIN_VALUE = '__official_login__'
const BACK_VALUE = '__back__'

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

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

export function ProviderFlow({
  onDone,
}: {
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const { columns } = useTerminalSize()
  const [step, setStep] = useState<
    | 'menu'
    | 'auth'
    | 'oauth'
    | 'codex-oauth'
    | 'endpoint'
    | 'key'
    | 'verifying'
    | 'models'
  >('menu')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [endpointInput, setEndpointInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [setupMessage, setSetupMessage] = useState('')

  useExitOnCtrlCDWithKeybindings(() => onDone('', { display: 'skip' }))

  const finishWithProvider = useCallback(
    async (id: string, key: string) => {
      const def = getProvider(id)
      const trimmed = key.trim()
      setStep('verifying')
      setError(null)

      const probe = isLocalProvider(def)
        ? {
            ok: true as const,
            verified: true,
            message: `${def?.label || id} is ready.`,
          }
        : await verifyProviderApiKey(id, trimmed)
      if (!probe.ok) {
        setError(probe.message)
        setStep('key')
        return
      }

      if (trimmed) setProviderKey(id, trimmed)
      const latest = loadState()
      const existingModel = getActiveModelId(id, latest)
      if (!existingModel) {
        const firstModel = getDefaultModelId(def)
        if (firstModel) setActiveModel(firstModel, id)
      }
      setSetupMessage(`Provider configured. ${probe.message}`)
      setStep('models')
    },
    [],
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

  if (step === 'verifying' && selectedId) {
    const def = getProvider(selectedId)
    return (
      <Frame subtitle={`Checking · ${def?.label || selectedId}`}>
        <Box flexDirection="row" gap={1}>
          <Spinner />
          <Text>Verifying provider connection…</Text>
        </Box>
        <Text dimColor>The key is not saved until this check passes.</Text>
      </Frame>
    )
  }

  if (step === 'models' && selectedId) {
    return (
      <Frame subtitle="Provider ready · choose a model">
        <TovyrProviderModelPicker
          initialProviderId={selectedId}
          setupMessage={setupMessage}
          onDone={onDone}
          onBack={() => setStep('auth')}
        />
      </Frame>
    )
  }

  if (step === 'oauth' && selectedId) {
    const def = getProvider(selectedId)
    return (
      <Frame subtitle={`Secure browser login · ${def?.label || selectedId}`}>
        <ConsoleOAuthFlow
          forceLoginMethod="claudeai"
          startingMessage="Sign in to Anthropic for subscription-backed models. Tovyr stores this connection only in ~/.tovyr and never reads or changes Claude Code credentials."
          onDone={() => {
            setProviderAuth(selectedId, 'oauth')
            setActiveProvider(selectedId)
            setSetupMessage(
              'Provider configured. Browser login is stored in Tovyr only.',
            )
            setStep('models')
          }}
        />
      </Frame>
    )
  }

  if (step === 'codex-oauth' && selectedId) {
    const def = getProvider(selectedId)
    return (
      <Frame subtitle={`Secure browser login - ${def?.label || selectedId}`}>
        <CodexAccountLogin
          onConnected={() => {
            setProviderAuth(selectedId, 'oauth')
            setActiveProvider(selectedId)
            setSetupMessage(
              'Provider configured. ChatGPT is connected through the official Codex CLI.',
            )
            setStep('models')
          }}
        />
      </Frame>
    )
  }

  if (step === 'auth' && selectedId) {
    const def = getProvider(selectedId)
    const officialLogin = getOfficialProviderLogin(selectedId)
    const authOptions = [
      {
        value: API_KEY_VALUE,
        label: 'API key',
        description: `Connect ${def?.label || selectedId} directly inside Tovyr`,
      },
      ...(officialLogin
        ? [
            {
              value: OFFICIAL_LOGIN_VALUE,
              label: `Login with ${officialLogin.label}`,
              description:
                'Open the official provider CLI · credentials stay isolated',
            },
          ]
        : []),
      {
        value: BACK_VALUE,
        label: 'Back',
        description: 'Choose another provider',
      },
    ]

    return (
      <Frame subtitle={`Connect · ${def?.label || selectedId}`}>
        <Text bold>How do you want to connect?</Text>
        <Text dimColor>
          API keys activate models in Tovyr. Official account login runs the
          provider’s own CLI session.
        </Text>
        <Box marginTop={1}>
          <Select
            options={authOptions}
            defaultFocusValue={API_KEY_VALUE}
            onChange={value => {
              if (value === BACK_VALUE) {
                setStep('menu')
                return
              }
              if (value === OFFICIAL_LOGIN_VALUE && officialLogin) {
                if (selectedId === 'anthropic') {
                  setStep('oauth')
                  return
                }
                if (selectedId === 'openai') {
                  setStep('codex-oauth')
                  return
                }
                onDone(
                  `Continue with ${officialLogin.label}:\n\n  ${officialLogin.command}\n\nThat provider keeps its own credentials separate from Tovyr.`,
                  { display: 'system' },
                )
                return
              }
              setInput('')
              setCursorOffset(0)
              setError(null)
              setStep(def?.baseUrl ? 'key' : 'endpoint')
            }}
            onCancel={() => setStep('menu')}
          />
        </Box>
      </Frame>
    )
  }

  if (step === 'endpoint' && selectedId) {
    const def = getProvider(selectedId)
    const handleEndpointSubmit = (): void => {
      const value = endpointInput.trim()
      try {
        const url = new URL(value)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Unsupported protocol')
        }
      } catch {
        setError('Enter a valid http:// or https:// provider endpoint.')
        return
      }
      setCustomProvider({ baseUrl: value, providerId: selectedId })
      setError(null)
      setStep('key')
    }

    return (
      <Frame subtitle={`Endpoint · ${def?.label || selectedId}`}>
        <Text>
          Enter the Tovyr-compatible or OpenAI-compatible endpoint for{' '}
          <Text bold>{def?.label || selectedId}</Text>.
        </Text>
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor={error ? 'error' : 'secondaryText'}
          paddingX={1}
        >
          <TextInput
            value={endpointInput}
            onChange={setEndpointInput}
            onSubmit={handleEndpointSubmit}
            onPaste={setEndpointInput}
            focus
            placeholder="https://api.example.com/v1"
            columns={columns}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            showCursor
          />
        </Box>
        {error ? <Text color="error">{error}</Text> : null}
        <Text dimColor>Enter to continue · Ctrl+C to cancel</Text>
      </Frame>
    )
  }

  if (step === 'key' && selectedId) {
    const def = getProvider(selectedId)
    const savedKey = loadState().keys?.[selectedId] || ''
    const hasSavedKey = isValidKey(def, savedKey)
    return (
      <Frame subtitle={`API key · ${def?.label || selectedId}`}>
        <Text>
          {hasSavedKey ? 'Paste a replacement key or press Enter to verify the saved key for ' : 'Paste your API key for '}
          <Text bold>{def?.label || selectedId}</Text>
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
          <Text dimColor>{def?.signup ? `Get a key: ${def.signup}` : 'Tovyr-compatible endpoint'}</Text>
        )}
        <Box marginTop={1}>
          <Text dimColor>Enter to verify and connect · Ctrl+C to cancel</Text>
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

  const options: Array<any> = [
    {
      type: 'input',
      value: SEARCH_VALUE,
      label: 'Search providers',
      placeholder: 'Type to filter providers...',
      onChange: (value: string) => setSearchQuery(value),
      allowEmptySubmitToCancel: false,
    },
  ]

  for (const category of listProviderCategoriesOrdered()) {
    const matchingProviders = category.providers.filter(entry => {
      if (!searchQuery) return true
      const def = getProvider(entry.id, state)
      const text = `${def?.label || ''} ${def?.id || ''} ${entry.id} ${category.label} ${def?.keyHint || ''}`
      return fuzzyMatch(text, searchQuery)
    })
    if (matchingProviders.length === 0) continue

    options.push({
      value: `__header_${category.id}`,
      label: `— ${category.label} —`,
      disabled: true,
    })
    for (const entry of matchingProviders) {
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
        <Text dimColor>↑/↓ to move · Enter to choose a provider · type in “Search providers” to filter</Text>
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
            if (value === SEARCH_VALUE) {
              const firstProvider = options.find(
                o => o.value !== SEARCH_VALUE && !String(o.value).startsWith('__header_') && o.value !== DONE_VALUE && !o.disabled,
              )
              if (!firstProvider) return
              value = firstProvider.value
            }
            const def = getProvider(value)
            if (def && isMediaProviderCategory(def.category)) {
              onDone(
                `${def.label} is a ${categoryLabel(def.category)} — not a chat LLM. Pick a gateway or API provider above for coding.`,
              )
              return
            }
            setSelectedId(value)
            setError(null)
            setSetupMessage('')
            if (isLocalProvider(def)) {
              void finishWithProvider(value, '')
              return
            }
            setStep('auth')
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
    if (sub === 'test') {
      const snapshot = await probeActiveProviderConnection({ force: true })
      const message = formatProviderConnectionSnapshot(snapshot)
      const node = ProviderCard(message)
      return emitStatic(onDone, node, message)
    }

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

  return <ProviderFlow onDone={onDone} />
}

const provider = {
  type: 'local-jsx',
  name: 'provider',
  description: 'Tovyr — connect AI providers and switch models',
  argumentHint: '[test | use <id> | model <id> | key <key> | url <id> <url> | list]',
  load: () => import('./provider.js'),
} satisfies Command

export default provider

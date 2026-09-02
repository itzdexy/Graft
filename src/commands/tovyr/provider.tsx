import * as React from 'react'
import { useCallback, useState } from 'react'
import type { Command, LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { Select } from '../../components/CustomSelect/select.js'
import TextInput from '../../components/TextInput.js'
import { TovyrSearchList } from '../../components/tovyr/TovyrSearchList.js'
import { Spinner } from '../../components/Spinner.js'
import { ConsoleOAuthFlow } from '../../components/ConsoleOAuthFlow.js'
import { TovyrProviderModelPicker } from '../../components/tovyr/TovyrProviderModelPicker.js'
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
  listActivatedProviderIds,
  listProviderCategoriesOrdered,
  isMediaProviderCategory,
  getDefaultModelId,
  setActiveProvider,
  setActiveModel,
  setProviderKey,
  setProviderAuth,
  setCustomProvider,
} from '../../../scripts/tovyr-providers.js'
import {
  applyActiveProviderSession,
  formatProviderAppliedMessage,
} from '../../services/tovyr/applyActiveProvider.js'
import { getCachedProviderModelIds } from '../../services/tovyr/providerModels.js'
import { activateProviderModel } from '../../services/tovyr/activateProviderModel.js'
import {
  getOfficialProviderLogin,
  verifyProviderApiKey,
} from '../../services/tovyr/providerSetup.js'
import { isLocalProvider } from '../../../scripts/tovyr-provider-local.js'
import { isNetworkConnected } from '../../utils/network.js'
import { CodexAccountLogin } from '../../components/tovyr/CodexAccountLogin.js'
import {
  formatProviderConnectionSnapshot,
  probeActiveProviderConnection,
} from '../../services/tovyr/providers/probe.js'
import {
  formatSearchSummary,
  searchProviders,
} from '../../services/tovyr/search/pickerSearch.js'
import {
  buildProviderRows,
  presentProviderRow,
  providerRowGroup,
  shouldIncludeMediaProviders,
  type ProviderCatalogEntry,
  type ProviderCategoryGroup,
} from '../../services/tovyr/search/providerRows.js'

const ACCENT = 'suggestion'
const API_KEY_VALUE = '__api_key__'
const OFFICIAL_LOGIN_VALUE = '__official_login__'
const BACK_VALUE = '__back__'

function categoryLabel(cat: string): string {
  return (PROVIDER_CATEGORIES as Record<string, string>)[cat] || cat || 'Provider'
}

/**
 * Flat one-line header, matching `/model`.
 *
 * This was a bordered card with a mascot sprite and a stacked title block:
 * six rows of chrome above the thing the dialog exists to show. On an 80x24
 * terminal that pushed the provider list itself below the fold.
 */
function Frame({
  subtitle,
  children,
}: {
  subtitle: string
  children: React.ReactNode
}): React.ReactNode {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text wrap="truncate-end">
        <Text bold color={ACCENT}>
          Tovyr
        </Text>
        <Text color="subtle" dimColor>{`  ${subtitle}`}</Text>
      </Text>
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
          borderColor={error ? 'error' : 'subtle'}
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
        <Box marginTop={1} borderStyle="round" borderColor={error ? 'error' : 'subtle'} paddingX={1}>
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
    activeDef?.models.find((m: { id: string; label: string }) => m.id === activeModel)
      ?.label || activeModel
  const isOnline = isNetworkConnected()

  // Rows are rebuilt on every keystroke; the search list owns the cursor, so
  // rebuilding no longer disturbs where the user is (see resolveResetFocusValue).
  const rows = buildProviderRows({
    categories: listProviderCategoriesOrdered().map((category: ProviderCategoryGroup) => ({
      id: category.id,
      label: category.label,
      providers: category.providers.map((entry: ProviderCatalogEntry) => ({
        id: entry.id,
        label: entry.label,
        category: entry.category,
        keyHint: entry.keyHint,
        anyModel: entry.anyModel,
      })),
    })),
    activeProviderId: activeId,
    connectedIds: new Set(listActivatedProviderIds(state)),
    localIds: new Set(
      listProviderIds().filter((id: string) =>
        isLocalProvider(getProvider(id, state)),
      ),
    ),
    isOnline,
    includeMedia: shouldIncludeMediaProviders(searchQuery),
  })
  const connectedCount = rows.filter(row => row.connected).length
  const ranked = searchProviders(rows, searchQuery)

  const items = ranked.map(({ item, indices }, index) => {
    const presentation = presentProviderRow(item)
    return {
      key: item.id,
      label: item.label,
      detail: presentation.detail,
      badge: presentation.badge,
      badgeTone: presentation.badgeTone,
      group: providerRowGroup(item, index, connectedCount, searchQuery),
      matchIndices: indices,
    }
  })

  return (
    <Frame subtitle="Providers">
      <TovyrSearchList
        title="Connect a provider"
        items={items}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        placeholder={`Search ${listProviderIds().length} providers — name, id, or what they serve`}
        summary={formatSearchSummary({
          shown: ranked.length,
          total: rows.length,
          noun: 'provider',
          query: searchQuery,
        })}
        status={
          <Text color="subtle" dimColor wrap="truncate-end">
            {'Active '}
            <Text color="success">{activeDef?.label || activeId || 'none'}</Text>
            {activeModelLabel ? <Text color="text">{` · ${activeModelLabel}`}</Text> : null}
          </Text>
        }
        notice={
          isOnline
            ? null
            : {
                tone: 'warning',
                text: 'No network detected — only local providers (Ollama, LM Studio) are listed.',
              }
        }
        emptyMessage={
          searchQuery.trim()
            ? `No provider matches "${searchQuery.trim()}".`
            : 'No providers available.'
        }
        initialKey={activeId || undefined}
        visibleCount={12}
        onCancel={() => onDone('', { display: 'skip' })}
        onSelect={id => {
          const def = getProvider(id)
          if (def && isMediaProviderCategory(def.category)) {
            onDone(
              `${def.label} is a ${categoryLabel(def.category)} — not a chat LLM. Pick a model API or gateway for coding.`,
            )
            return
          }
          setSelectedId(id)
          setError(null)
          setSetupMessage('')
          if (isLocalProvider(def)) {
            void finishWithProvider(id, '')
            return
          }
          setStep('auth')
        }}
      />
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
      const result = await activateProviderModel({
        providerId,
        modelId,
        setAppState: _context.setAppState,
      })
      if (!result.ok) {
        const msg = result.message
        const node = ProviderCard(msg)
        return emitStatic(onDone, node, msg)
      }
      const message = `Active model → ${result.modelId}.`
      const node = ProviderCard(message)
      return emitStatic(onDone, node, message)
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

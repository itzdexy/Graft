/**
 * The application adapter catalog is deliberately data-only.  Discovery and
 * launch code consume these manifests, which keeps the supported-client list
 * consistent across `apps list`, status, and the compatibility aliases.
 */

export const APP_INTEGRATION_KINDS = Object.freeze([
  'model-routing',
  'tool-only',
  'manual-setup',
])

export const APP_READINESS = Object.freeze([
  'ready',
  'manual-setup',
  'tool-only',
  'missing',
  'unsupported-version',
])

const LOCAL_OPENAI_ENDPOINT = 'http://127.0.0.1:11434/v1'
const LOCAL_ANTHROPIC_ENDPOINT = 'http://127.0.0.1:11434'

const manifests = [
  {
    id: 'codex',
    label: 'Codex CLI',
    integrationKind: 'model-routing',
    readiness: 'ready',
    protocol: 'openai-responses',
    command: 'codex',
    recovery: 'Run `graft codex` after the gateway is available.',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT Desktop (Codex view)',
    integrationKind: 'model-routing',
    readiness: 'ready',
    protocol: 'openai-responses',
    command: 'ChatGPT',
    packageName: 'OpenAI.Codex',
    executableRelativePath: 'app\\ChatGPT.exe',
    recovery: 'Install the current ChatGPT desktop app with its Codex view, then run `graft chatgpt`.',
    note: 'Chat and Work views continue to use their hosted OpenAI models; Graft routing applies to Codex only.',
  },
  {
    id: 'claude-code',
    label: 'Claude Code CLI',
    integrationKind: 'model-routing',
    readiness: 'ready',
    protocol: 'anthropic-messages',
    command: 'claude',
    recovery: 'Install Claude Code and run `graft claude` again.',
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    integrationKind: 'tool-only',
    readiness: 'tool-only',
    protocol: 'mcp-stdio',
    command: null,
    recovery: 'Run `graft mcp serve` and add that stdio server in Claude Desktop.',
    note: 'Claude Desktop does not expose a supported custom model endpoint; Graft is available as MCP tools.',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    integrationKind: 'manual-setup',
    readiness: 'manual-setup',
    protocol: 'openai-compatible',
    command: 'opencode',
    endpointPath: LOCAL_OPENAI_ENDPOINT,
    modelFormat: '<provider>::<model>',
    recovery: 'Copy the endpoint recipe from `graft apps configure opencode` into OpenCode.',
  },
  {
    id: 'hermes-agent',
    label: 'Hermes Agent',
    integrationKind: 'manual-setup',
    readiness: 'manual-setup',
    protocol: 'openai-compatible',
    command: 'hermes',
    endpointPath: LOCAL_OPENAI_ENDPOINT,
    modelFormat: '<provider>::<model>',
    recovery: 'Copy the endpoint recipe from `graft apps configure hermes-agent` into Hermes Agent.',
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    integrationKind: 'manual-setup',
    readiness: 'manual-setup',
    protocol: 'openai-compatible',
    command: 'openclaw',
    endpointPath: LOCAL_OPENAI_ENDPOINT,
    modelFormat: '<provider>::<model>',
    recovery: 'Copy the endpoint recipe from `graft apps configure openclaw` into OpenClaw.',
  },
  {
    id: 'droid',
    label: 'Droid',
    integrationKind: 'manual-setup',
    readiness: 'manual-setup',
    protocol: 'openai-compatible',
    command: 'droid',
    endpointPath: LOCAL_OPENAI_ENDPOINT,
    modelFormat: '<provider>::<model>',
    recovery: 'Copy the endpoint recipe from `graft apps configure droid` into Droid.',
  },
  {
    id: 'pi',
    label: 'Pi',
    integrationKind: 'manual-setup',
    readiness: 'manual-setup',
    protocol: 'openai-compatible',
    command: 'pi',
    endpointPath: LOCAL_OPENAI_ENDPOINT,
    modelFormat: '<provider>::<model>',
    recovery: 'Copy the endpoint recipe from `graft apps configure pi` into Pi.',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    integrationKind: 'manual-setup',
    readiness: 'manual-setup',
    protocol: 'openai-compatible',
    command: 'kimi',
    endpointPath: LOCAL_OPENAI_ENDPOINT,
    modelFormat: '<provider>::<model>',
    recovery: 'Copy the endpoint recipe from `graft apps configure kimi` into Kimi.',
  },
  {
    id: 'copilot-cli',
    label: 'GitHub Copilot CLI',
    integrationKind: 'tool-only',
    readiness: 'tool-only',
    protocol: 'mcp-stdio',
    command: 'copilot',
    recovery: 'Run `graft mcp serve` and add Graft as an MCP server in Copilot CLI.',
    note: 'Copilot CLI model selection is controlled by GitHub; Graft is exposed as tools.',
  },
  {
    id: 'openai-compatible',
    label: 'Any OpenAI-compatible client',
    integrationKind: 'manual-setup',
    readiness: 'manual-setup',
    protocol: 'openai-compatible',
    command: null,
    endpointPath: LOCAL_OPENAI_ENDPOINT,
    modelFormat: '<provider>::<model>',
    recovery: 'Copy the endpoint recipe from `graft apps configure openai-compatible` into the client.',
  },
]

function freezeManifest(manifest) {
  return Object.freeze({ ...manifest })
}

const APPS = Object.freeze(manifests.map(freezeManifest))
const APP_IDS = Object.freeze(APPS.map(app => app.id))

export { APP_IDS }

export function listAppAdapters() {
  return APPS.map(app => ({ ...app }))
}

export function getAppAdapter(id) {
  const normalized = String(id ?? '').trim().toLowerCase()
  const app = APPS.find(candidate => candidate.id === normalized)
  return app ? { ...app } : null
}

export function getLocalEndpoint(protocol) {
  return protocol === 'anthropic-messages' ? LOCAL_ANTHROPIC_ENDPOINT : LOCAL_OPENAI_ENDPOINT
}

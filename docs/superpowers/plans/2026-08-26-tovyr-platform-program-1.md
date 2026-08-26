# Tovyr Platform Program 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tovyr's built-in Ollama request path and an authenticated local compatibility gateway consume the same typed provider/model core, while also supporting FreeModel and configurable OpenAI-compatible endpoints.

**Architecture:** Add typed registries and protocol-neutral request/events in front of the live `scripts/tovyr-providers.js` state. Provider adapters perform real OpenAI- or Anthropic-compatible HTTP streaming. The existing OpenAI compatibility proxy and the new loopback gateway both call the same inference service, proving that the built-in agent and external clients share provider, model, capability, health, and routing state.

**Tech Stack:** TypeScript, Bun, React/Ink-compatible service modules, Bun HTTP server, Web Streams/SSE, `bun:test`, existing Tovyr provider and OpenAI conversion utilities.

**Spec:** `docs/superpowers/specs/2026-08-26-tovyr-unified-ai-platform-design.md`

## Global Constraints

- Run Tovyr through the Bun/source CLI; do not create or launch `tovyr.exe`.
- Run commands from the project working directory.
- Preserve `/model`, `/init` → `tovyr.md`, `/plan` → `tovyrplan.md`, and `/code` behavior.
- Preserve the active-mode prompt footer and one-live-activity-row behavior.
- Keep automatic cross-provider failover opt-in.
- Do not commit or publish API keys, tokens, credentials, or fixture secrets.
- Preserve unrelated dirty-worktree changes and avoid broad rewrites.
- Keep `scripts/tovyr-providers.js` as the persistence implementation during Program 1; add a typed facade rather than a second store.
- Gateway binds to loopback only by default and requires a generated bearer token.
- Program 1 does not import or ship `packages/tovyrroute/`.

## File Structure

New platform code lives under `services/tovyr/platform/`:

- `types.ts` — protocol-neutral requests, content, tools, usage, and stream events.
- `providerRegistry.ts` — typed facade over the live provider state and model metadata.
- `adapterRegistry.ts` — resolves the adapter family for a provider selection.
- `adapters/openAiCompatible.ts` — OpenAI Chat Completions transport.
- `adapters/anthropicCompatible.ts` — Anthropic Messages transport.
- `inference.ts` — shared validation, routing, cancellation, and adapter invocation.
- `codecs/anthropic.ts` — shared Anthropic Messages normalization and event encoding used by the existing agent proxy and public gateway.
- `gateway/config.ts` — bind/port/token configuration and persisted gateway state.
- `gateway/auth.ts` — bearer-token creation, hashing, verification, rotation, and redaction.
- `gateway/protocols/openaiChat.ts` — OpenAI Chat request/response codec.
- `gateway/protocols/openaiResponses.ts` — OpenAI Responses request/response codec.
- `gateway/protocols/anthropicMessages.ts` — Anthropic Messages request/response codec.
- `gateway/server.ts` — authenticated loopback HTTP server and lifecycle.
- `gateway/command.ts` — Commander registration and serve/status/stop handlers.

Existing code changes are deliberately narrow:

- `services/tovyr/openAiCompat/proxy.ts` delegates its upstream request to shared inference for OpenAI-compatible active providers.
- `services/tovyr/applyProviderEnv.ts` resolves selections through the typed registry facade.
- `main.tsx` registers the gateway command through one extracted function.
- `entrypoints/cli.tsx` fast help advertises `tovyr serve`.
- `docs/GUIDE.md` documents the initial gateway contract.

---

### Task 1: Define the protocol-neutral platform contract

**Files:**

- Create: `services/tovyr/platform/types.ts`
- Create: `services/tovyr/platform/types.test.ts`

**Interfaces:**

- Produces `NormalizedModelRequest`, `NormalizedMessage`, `NormalizedContentPart`, `NormalizedTool`, `NormalizedToolChoice`, `NormalizedProviderStreamEvent`, `ResolvedProviderSelection`, and `ProviderAdapter`.
- Later tasks consume these exact exported names.

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, test } from 'bun:test'
import {
  assertNormalizedRequest,
  PlatformRequestError,
} from './types.js'

describe('normalized platform request', () => {
  test('accepts a bounded text request with tools', () => {
    expect(
      assertNormalizedRequest({
        model: 'ollama::qwen2.5-coder:1.5b',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        tools: [{ name: 'Read', description: 'Read a file', inputSchema: { type: 'object' } }],
        stream: true,
      }).model,
    ).toBe('ollama::qwen2.5-coder:1.5b')
  })

  test('rejects an empty conversation', () => {
    expect(() => assertNormalizedRequest({ model: 'x', messages: [] })).toThrow(
      PlatformRequestError,
    )
  })
})
```

- [ ] **Step 2: Run the test and verify the contract does not exist**

Run: `bun test services/tovyr/platform/types.test.ts`  
Expected: FAIL because `types.ts` and its exports do not exist.

- [ ] **Step 3: Implement the contract and bounded validator**

```ts
export type NormalizedContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; data?: string; url?: string }
  | { type: 'tool_call'; id: string; name: string; arguments: unknown }
  | { type: 'tool_result'; toolCallId: string; content: string; isError?: boolean }

export type NormalizedMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: NormalizedContentPart[]
}

export type NormalizedTool = {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export type NormalizedToolChoice =
  | { type: 'auto' | 'none' | 'required' }
  | { type: 'tool'; name: string }

export type NormalizedModelRequest = {
  model: string
  messages: NormalizedMessage[]
  tools?: NormalizedTool[]
  toolChoice?: NormalizedToolChoice
  maxOutputTokens?: number
  temperature?: number
  topP?: number
  stop?: string[]
  effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra'
  stream: boolean
}

export type NormalizedProviderStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'reasoning_delta'; text: string }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_delta'; id: string; argumentsDelta: string }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'error'; kind: string; message: string; retryable: boolean }
  | { type: 'complete'; stopReason?: string }

export type ResolvedProviderSelection = {
  providerId: string
  providerLabel: string
  modelId: string
  baseUrl: string
  apiKey: string
  authMode: 'apiKey' | 'authToken' | 'oauth'
  protocol: 'openai' | 'anthropic'
}

export interface ProviderAdapter {
  readonly protocol: 'openai' | 'anthropic'
  stream(
    selection: ResolvedProviderSelection,
    request: NormalizedModelRequest,
    signal: AbortSignal,
  ): AsyncIterable<NormalizedProviderStreamEvent>
}
```

Add `PlatformRequestError` and `assertNormalizedRequest(value: unknown)` with explicit limits: at least one message, non-empty model, at most 256 messages, 128 tools, and 64 MiB estimated serialized input.

- [ ] **Step 4: Run the focused test**

Run: `bun test services/tovyr/platform/types.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- services/tovyr/platform/types.ts services/tovyr/platform/types.test.ts
git commit -m "feat: define Tovyr platform request contracts"
```

### Task 2: Add the typed provider and model registry facade

**Files:**

- Create: `services/tovyr/platform/providerRegistry.ts`
- Create: `services/tovyr/platform/providerRegistry.test.ts`
- Modify: `services/tovyr/applyProviderEnv.ts`

**Interfaces:**

- Consumes existing `loadState`, `getProvider`, `resolveActive`, `resolveProviderSelection`, model-capability functions, and provider readiness cache.
- Produces:

```ts
export function getActivePlatformSelection(): ResolvedProviderSelection | null
export function resolvePlatformSelection(
  providerId: string,
  modelId?: string,
): ResolvedProviderSelection | null
export function listPlatformModels(providerId?: string): ModelDescriptor[]
export function parseQualifiedModel(value: string): { providerId?: string; modelId: string }
export function qualifyModel(providerId: string, modelId: string): string
```

- [ ] **Step 1: Write failing isolated-home tests**

Cover `ollama::qwen2.5-coder:1.5b`, active FreeModel resolution, custom endpoint resolution, secrets excluded from `listPlatformModels`, and the existing default-provider behavior.

- [ ] **Step 2: Verify failure**

Run: `bun test services/tovyr/platform/providerRegistry.test.ts`  
Expected: FAIL because the facade does not exist.

- [ ] **Step 3: Implement the facade without new persistence**

Map `providerNeedsOpenAiCompat(provider)` to `protocol: 'openai'`; all other current chat providers use `protocol: 'anthropic'`. Merge existing `resolveModelDescriptor`/capability metadata rather than copying the provider catalog.

- [ ] **Step 4: Route environment application through the facade**

Change `applyProviderEnv.ts` to obtain the active selection from `getActivePlatformSelection()` while preserving the exact environment variables and OpenAI proxy behavior it currently applies.

- [ ] **Step 5: Run focused and regression tests**

Run:

```powershell
bun test services/tovyr/platform/providerRegistry.test.ts services/tovyr/applyProviderEnv.test.ts services/tovyr/freeLocalMode.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- services/tovyr/platform/providerRegistry.ts services/tovyr/platform/providerRegistry.test.ts services/tovyr/applyProviderEnv.ts
git commit -m "refactor: expose live providers through platform registry"
```

### Task 3: Implement the OpenAI-compatible provider adapter

**Files:**

- Create: `services/tovyr/platform/adapters/openAiCompatible.ts`
- Create: `services/tovyr/platform/adapters/openAiCompatible.test.ts`

**Interfaces:**

- Consumes `ResolvedProviderSelection`, `NormalizedModelRequest`, and existing tool-name/argument normalization.
- Produces `openAiCompatibleAdapter: ProviderAdapter`.
- Supports Ollama and arbitrary configured OpenAI-compatible endpoints through the same implementation.

- [ ] **Step 1: Write failing fake-fetch tests**

Tests must cover request conversion, bearer auth omission for `local-only`, streamed text, reasoning text, fragmented tool-call arguments, usage, `[DONE]`, non-stream JSON, empty body, HTML body, abort propagation, and redacted upstream errors.

- [ ] **Step 2: Verify failure**

Run: `bun test services/tovyr/platform/adapters/openAiCompatible.test.ts`  
Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement request conversion**

Expose for testability:

```ts
export function normalizedRequestToOpenAi(
  selection: ResolvedProviderSelection,
  request: NormalizedModelRequest,
): Record<string, unknown>

export async function* decodeOpenAiResponse(
  response: Response,
): AsyncGenerator<NormalizedProviderStreamEvent>

export const openAiCompatibleAdapter: ProviderAdapter
```

Use `openAiChatCompletionsUrl(selection.baseUrl)`, `Authorization: Bearer` only for real keys, `Content-Type: application/json`, and the caller's `AbortSignal`.

- [ ] **Step 4: Run tests**

Run: `bun test services/tovyr/platform/adapters/openAiCompatible.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- services/tovyr/platform/adapters/openAiCompatible.ts services/tovyr/platform/adapters/openAiCompatible.test.ts
git commit -m "feat: add shared OpenAI-compatible provider adapter"
```

### Task 4: Implement the Anthropic-compatible provider adapter

**Files:**

- Create: `services/tovyr/platform/adapters/anthropicCompatible.ts`
- Create: `services/tovyr/platform/adapters/anthropicCompatible.test.ts`

**Interfaces:**

- Produces `anthropicCompatibleAdapter: ProviderAdapter` for FreeModel and existing Anthropic-compatible providers.

- [ ] **Step 1: Write failing transport tests**

Cover `x-api-key` and bearer auth modes, system extraction, tool schemas, SSE text/tool/usage events, JSON responses, API errors, abort propagation, and no secret text in normalized errors.

- [ ] **Step 2: Verify failure**

Run: `bun test services/tovyr/platform/adapters/anthropicCompatible.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement the adapter**

Expose:

```ts
export function normalizedRequestToAnthropic(
  selection: ResolvedProviderSelection,
  request: NormalizedModelRequest,
): Record<string, unknown>

export async function* decodeAnthropicResponse(
  response: Response,
): AsyncGenerator<NormalizedProviderStreamEvent>

export const anthropicCompatibleAdapter: ProviderAdapter
```

Use `/v1/messages` exactly once when constructing the URL, preserve tool result ordering, and map Anthropic stop reasons to the normalized completion event.

- [ ] **Step 4: Run tests and commit**

Run: `bun test services/tovyr/platform/adapters/anthropicCompatible.test.ts`  
Expected: PASS.

```powershell
git add -- services/tovyr/platform/adapters/anthropicCompatible.ts services/tovyr/platform/adapters/anthropicCompatible.test.ts
git commit -m "feat: add shared Anthropic-compatible provider adapter"
```

### Task 5: Add the shared inference service and adapter registry

**Files:**

- Create: `services/tovyr/platform/adapterRegistry.ts`
- Create: `services/tovyr/platform/inference.ts`
- Create: `services/tovyr/platform/inference.test.ts`

**Interfaces:**

```ts
export function adapterForSelection(
  selection: ResolvedProviderSelection,
): ProviderAdapter

export type PlatformInferenceOptions = {
  providerId?: string
  signal: AbortSignal
}

export function streamPlatformInference(
  request: NormalizedModelRequest,
  options: PlatformInferenceOptions,
): AsyncIterable<NormalizedProviderStreamEvent>
```

- [ ] **Step 1: Write failing routing tests**

Inject fake adapters and prove explicit qualified model selection, active-provider fallback, OpenAI versus Anthropic selection, incompatible tool rejection, cancellation, normalized error finalization, and no cross-provider failover when the opt-in flags are absent.

- [ ] **Step 2: Verify failure**

Run: `bun test services/tovyr/platform/inference.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement resolution and event guarantees**

The service validates the request, resolves exactly one selection, checks known capability conflicts, invokes the adapter, yields at most one terminal `error` or `complete`, and never persists a routing fallback.

- [ ] **Step 4: Run tests and commit**

Run: `bun test services/tovyr/platform/inference.test.ts`  
Expected: PASS.

```powershell
git add -- services/tovyr/platform/adapterRegistry.ts services/tovyr/platform/inference.ts services/tovyr/platform/inference.test.ts
git commit -m "feat: add shared Tovyr inference service"
```

### Task 6: Migrate the built-in Ollama request path to shared inference

**Files:**

- Modify: `services/tovyr/openAiCompat/proxy.ts`
- Modify: `services/tovyr/openAiCompat/proxy.test.ts`
- Create: `services/tovyr/openAiCompat/platformBridge.test.ts`
- Create: `services/tovyr/platform/codecs/anthropic.ts`
- Create: `services/tovyr/platform/codecs/anthropic.test.ts`

**Interfaces:**

- The proxy retains its existing synchronous start/environment API.
- Its `/v1/messages` handler converts the Anthropic request to `NormalizedModelRequest`, calls `streamPlatformInference`, and encodes normalized events back to Anthropic Messages SSE/JSON.
- A dependency injection seam allows existing proxy unit tests to avoid real provider calls.

- [ ] **Step 1: Add a failing bridge test**

Start the proxy with an isolated Ollama selection and fake platform inference. POST an Anthropic Messages request containing a tool schema and assert the fake inference receives provider `ollama`, the active model, messages, and tool schema. Assert returned text/tool events form valid Anthropic SSE.

- [ ] **Step 2: Verify failure**

Run: `bun test services/tovyr/openAiCompat/platformBridge.test.ts`  
Expected: FAIL because the proxy still calls OpenAI fetch/converters directly.

- [ ] **Step 3: Add protocol-neutral bridge conversion**

Implement these shared functions in `services/tovyr/platform/codecs/anthropic.ts` and import them from both the existing proxy and Task 9's public Anthropic gateway codec:

```ts
export function decodeAnthropicMessages(
  value: unknown,
): NormalizedModelRequest

export function collectAnthropicJson(
  model: string,
  events: NormalizedProviderStreamEvent[],
): Record<string, unknown>

export function streamAnthropicEvents(
  model: string,
  events: AsyncIterable<NormalizedProviderStreamEvent>,
): ReadableStream<Uint8Array>
```

Do not duplicate the streaming state machine in the proxy or gateway wrapper.

- [ ] **Step 4: Preserve existing proxy contracts**

Run:

```powershell
bun test services/tovyr/openAiCompat/proxy.test.ts services/tovyr/openAiCompat/convert.test.ts services/tovyr/openAiCompat/platformBridge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- services/tovyr/openAiCompat/proxy.ts services/tovyr/openAiCompat/proxy.test.ts services/tovyr/openAiCompat/platformBridge.test.ts services/tovyr/platform/codecs
git commit -m "refactor: route Tovyr Ollama agent through platform core"
```

### Task 7: Implement gateway configuration and authentication

**Files:**

- Create: `services/tovyr/platform/gateway/config.ts`
- Create: `services/tovyr/platform/gateway/auth.ts`
- Create: `services/tovyr/platform/gateway/auth.test.ts`

**Interfaces:**

```ts
export type GatewayConfig = {
  host: string
  port: number
  requireAuth: true
}

export type GatewayTokenRecord = {
  id: string
  label: string
  hash: string
  createdAt: string
  revokedAt?: string
}

export function loadGatewayConfig(): GatewayConfig
export function ensureGatewayToken(label: string): { id: string; token?: string }
export function verifyGatewayBearer(header: string | null): boolean
export function revokeGatewayToken(id: string): boolean
export function redactGatewayToken(value: string): string
```

- [ ] **Step 1: Write failing isolated-home tests**

Prove default host is `127.0.0.1`, token plaintext is returned only on creation, persisted state contains only a salted hash, bearer verification uses constant-time comparison, revocation works, and config files use owner-only mode where supported.

- [ ] **Step 2: Verify failure**

Run: `bun test services/tovyr/platform/gateway/auth.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement atomic storage**

Store gateway state beneath the existing Tovyr home using `writeJsonAtomic`; use `crypto.randomBytes(32)` for tokens and `scryptSync(token, salt, 32)` with a per-token 16-byte random salt for stored verification material. Persist `salt` and `hash` as base64, compare derived bytes with `timingSafeEqual`, and never log raw tokens.

- [ ] **Step 4: Run tests and commit**

Run: `bun test services/tovyr/platform/gateway/auth.test.ts`  
Expected: PASS.

```powershell
git add -- services/tovyr/platform/gateway/config.ts services/tovyr/platform/gateway/auth.ts services/tovyr/platform/gateway/auth.test.ts
git commit -m "feat: secure the local Tovyr gateway"
```

### Task 8: Implement OpenAI Chat Completions protocol codec

**Files:**

- Create: `services/tovyr/platform/gateway/protocols/openaiChat.ts`
- Create: `services/tovyr/platform/gateway/protocols/openaiChat.test.ts`

**Interfaces:**

```ts
export function decodeOpenAiChatRequest(value: unknown): NormalizedModelRequest
export function encodeOpenAiChatJson(
  model: string,
  events: NormalizedProviderStreamEvent[],
): Record<string, unknown>
export function encodeOpenAiChatStream(
  model: string,
  events: AsyncIterable<NormalizedProviderStreamEvent>,
): ReadableStream<Uint8Array>
```

- [ ] **Step 1: Write fixture-driven failing tests**

Cover system/user/assistant/tool messages, multimodal image URLs, tool schemas, tool choice, streamed text, fragmented tool arguments, finish reasons, usage, errors, and `[DONE]`.

- [ ] **Step 2: Verify failure**

Run: `bun test services/tovyr/platform/gateway/protocols/openaiChat.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement the codec and run tests**

Every streaming frame must use `data: <json>\n\n`; errors before headers use HTTP JSON while errors after streaming begins use a final protocol-valid error frame followed by `[DONE]`.

Run: `bun test services/tovyr/platform/gateway/protocols/openaiChat.test.ts`  
Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add -- services/tovyr/platform/gateway/protocols/openaiChat.ts services/tovyr/platform/gateway/protocols/openaiChat.test.ts
git commit -m "feat: add OpenAI chat gateway codec"
```

### Task 9: Implement Anthropic Messages and OpenAI Responses codecs

**Files:**

- Create: `services/tovyr/platform/gateway/protocols/anthropicMessages.ts`
- Create: `services/tovyr/platform/gateway/protocols/anthropicMessages.test.ts`
- Create: `services/tovyr/platform/gateway/protocols/openaiResponses.ts`
- Create: `services/tovyr/platform/gateway/protocols/openaiResponses.test.ts`

**Interfaces:**

```ts
export function decodeAnthropicMessagesRequest(value: unknown): NormalizedModelRequest
export function encodeAnthropicMessagesJson(
  model: string,
  events: NormalizedProviderStreamEvent[],
): Record<string, unknown>
export function encodeAnthropicMessagesStream(
  model: string,
  events: AsyncIterable<NormalizedProviderStreamEvent>,
): ReadableStream<Uint8Array>

export function decodeOpenAiResponsesRequest(value: unknown): NormalizedModelRequest
export function encodeOpenAiResponsesJson(
  model: string,
  events: NormalizedProviderStreamEvent[],
): Record<string, unknown>
export function encodeOpenAiResponsesStream(
  model: string,
  events: AsyncIterable<NormalizedProviderStreamEvent>,
): ReadableStream<Uint8Array>
```

- [ ] **Step 1: Write failing protocol fixtures**

Anthropic tests cover system blocks, tool use/results, `message_start`, content blocks, usage deltas, and `message_stop`. Responses tests cover string/array input, function tools, `response.output_text.delta`, function-call argument deltas, completion, and error events.

- [ ] **Step 2: Verify failure**

Run:

```powershell
bun test services/tovyr/platform/gateway/protocols/anthropicMessages.test.ts services/tovyr/platform/gateway/protocols/openaiResponses.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement both codecs using shared normalized events**

Do not translate one public protocol into another public protocol. Decode each to the internal request and encode directly from normalized events.

- [ ] **Step 4: Run tests and commit**

Run the same focused command; expected PASS.

```powershell
git add -- services/tovyr/platform/gateway/protocols/anthropicMessages.ts services/tovyr/platform/gateway/protocols/anthropicMessages.test.ts services/tovyr/platform/gateway/protocols/openaiResponses.ts services/tovyr/platform/gateway/protocols/openaiResponses.test.ts
git commit -m "feat: add Messages and Responses gateway codecs"
```

### Task 10: Build the authenticated gateway server and lifecycle

**Files:**

- Create: `services/tovyr/platform/gateway/server.ts`
- Create: `services/tovyr/platform/gateway/server.test.ts`
- Create: `services/tovyr/platform/gateway/processState.ts`
- Create: `services/tovyr/platform/gateway/processState.test.ts`

**Interfaces:**

```ts
export type GatewayHandle = {
  url: string
  host: string
  port: number
  stop(): Promise<void>
}

export function startGateway(
  overrides?: Partial<GatewayConfig>,
): Promise<GatewayHandle>
export function readGatewayStatus(): {
  running: boolean
  url?: string
  pid?: number
}
```

- [ ] **Step 1: Write failing HTTP integration tests**

Use port `0` and fake platform inference. Verify `/health`, authenticated `/v1/models`, unauthorized 401, all three POST endpoints, stream content type, method rejection, malformed JSON, payload limits, loopback default, cancellation when a client disconnects, and status cleanup after stop.

- [ ] **Step 2: Verify failure**

Run: `bun test services/tovyr/platform/gateway/server.test.ts services/tovyr/platform/gateway/processState.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement routing and lifecycle**

Use `Bun.serve`, an injected `streamPlatformInference`, `AbortController` per request, bounded JSON reading, safe error JSON, and atomic process metadata. Reject non-loopback hosts unless an explicit `allowRemote` option and auth are supplied; Program 1 CLI does not expose `allowRemote`.

- [ ] **Step 4: Run tests and commit**

Run the focused command; expected PASS.

```powershell
git add -- services/tovyr/platform/gateway/server.ts services/tovyr/platform/gateway/server.test.ts services/tovyr/platform/gateway/processState.ts services/tovyr/platform/gateway/processState.test.ts
git commit -m "feat: serve the authenticated Tovyr compatibility gateway"
```

### Task 11: Integrate `tovyr serve` into the existing CLI

**Files:**

- Create: `services/tovyr/platform/gateway/command.ts`
- Create: `services/tovyr/platform/gateway/command.test.ts`
- Modify: `main.tsx`
- Modify: `entrypoints/cli.tsx`
- Modify: `bin/tovyr.js`

**Interfaces:**

```ts
export function registerGatewayCommand(program: CommanderCommand): void
export async function serveCommand(args: {
  host?: string
  port?: string
  status?: boolean
  stop?: boolean
}): Promise<void>
```

- [ ] **Step 1: Write failing command tests**

Verify `serve --help`, foreground start, `serve status --json`, `serve stop`, invalid port, remote-host rejection, and that bare `tovyr` remains the default interactive path.

- [ ] **Step 2: Verify failure**

Run: `bun test services/tovyr/platform/gateway/command.test.ts services/tovyr/launcherStartupContract.test.ts`  
Expected: FAIL for missing command while existing launch contract remains green.

- [ ] **Step 3: Register the command with minimal bootstrap impact**

Lazy-load gateway implementation inside the action. Add `serve` to launcher CLI-only detection only when needed; do not make bare launch start the gateway. Update fast help with:

```text
tovyr serve                   Start the local compatibility gateway
tovyr serve status            Show gateway status
```

- [ ] **Step 4: Run tests and commit**

Run the focused command; expected PASS.

```powershell
git add -- services/tovyr/platform/gateway/command.ts services/tovyr/platform/gateway/command.test.ts main.tsx entrypoints/cli.tsx bin/tovyr.js
git commit -m "feat: add Tovyr gateway CLI commands"
```

### Task 12: Prove shared state across agent and gateway

**Files:**

- Create: `services/tovyr/platform/sharedCore.integration.test.ts`
- Modify: `services/tovyr/openAiCompat/platformBridge.test.ts`

**Interfaces:**

- No new production interface; this task is the architectural acceptance gate.

- [ ] **Step 1: Write the end-to-end isolated-home test**

Start a fake Ollama server, set `~/.tovyr/providers.json` to Ollama/model A, start both the existing agent compatibility proxy and the new gateway, and issue equivalent requests. Assert both hit fake Ollama with model A. Transactionally activate model B through the existing provider state, issue both requests again, and assert both now use model B without separate gateway configuration.

Repeat with a fake FreeModel Messages endpoint and a configurable OpenAI endpoint. Cover streamed text and one tool call for each protocol family.

- [ ] **Step 2: Run and verify failure before final wiring**

Run: `bun test services/tovyr/platform/sharedCore.integration.test.ts`  
Expected before final wiring: FAIL if any consumer caches independent provider/model state.

- [ ] **Step 3: Correct only discovered shared-state gaps**

Use the typed registry/inference interfaces; do not add synchronization files or duplicate selections.

- [ ] **Step 4: Run the complete Program 1 focused suite**

```powershell
bun test services/tovyr/platform services/tovyr/openAiCompat services/tovyr/applyProviderEnv.test.ts services/tovyr/freeLocalMode.test.ts services/tovyr/launcherStartupContract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- services/tovyr/platform/sharedCore.integration.test.ts services/tovyr/openAiCompat/platformBridge.test.ts
git commit -m "test: prove Tovyr agent and gateway share model state"
```

### Task 13: Document and verify Program 1

**Files:**

- Modify: `docs/GUIDE.md`
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/SAFETY.md`

**Interfaces:**

- Documents only implemented behavior and exact commands.

- [ ] **Step 1: Add gateway usage and security documentation**

Document foreground lifecycle, retrieving the one-time token, curl examples for all three protocols, Ollama/FreeModel/custom setup, loopback-only default, token rotation/revocation, logs, and troubleshooting. Do not advertise application adapters before Programs 3–4.

- [ ] **Step 2: Run focused validation**

```powershell
bun test services/tovyr/platform services/tovyr/openAiCompat
bun run typecheck
bun run check:brand
bun run check:dead-ui
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 3: Run the full repository test suite**

Run: `bun test`  
Expected: PASS. If unrelated pre-existing failures occur, record the exact failing tests and confirm Program 1 focused tests still pass before deciding whether the failure is in scope.

- [ ] **Step 4: Run packaging smoke checks**

```powershell
npm run build:runtime
npm run publish:npm:dry-run
```

Expected: runtime build and dry-run package validation PASS without publishing.

- [ ] **Step 5: Commit documentation and verification record**

```powershell
git add -- docs/GUIDE.md README.md docs/DEPLOYMENT.md docs/SAFETY.md
git commit -m "docs: document the Tovyr compatibility gateway"
```

## Program 1 Completion Gate

Program 1 is complete only when fresh evidence proves:

- bare `tovyr` still launches the interactive agent;
- Ollama built-in-agent requests and gateway requests use the same typed
  selection and inference path;
- FreeModel and custom OpenAI-compatible gateway paths stream successfully in
  protocol fixtures;
- `/v1/chat/completions`, `/v1/responses`, and `/v1/messages` preserve text,
  tool calls/results, usage, finish reasons, errors, and cancellation;
- gateway defaults to authenticated loopback and stores no plaintext token;
- focused tests, typecheck, brand checks, dead-UI checks, runtime build, and npm
  dry-run pass;
- no file under `packages/tovyrroute/` is imported, tracked, or packaged.

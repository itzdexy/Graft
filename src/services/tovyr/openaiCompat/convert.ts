import { capAnthropicMaxTokensForTovyrModel } from '../modelContext.js'
import { resolveModelCapabilities } from '../modelCapabilities.js'
import { getActiveProviderId } from '../../../../scripts/tovyr-providers.js'
import { modelUsesOpenAiThinkingKwargs } from '../openAiModelSuitability.js'
import {
  recoverLeakedPythonTagTools,
  recoverAllLeakedToolCalls,
  type RecoveredToolUse,
} from './leakedToolSyntax.js'
import {
  normalizeToolName,
  normalizeToolArguments,
  parseLooseToolArguments,
} from './toolNormalization.js'

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | {
      type: 'image'
      source: {
        type: string
        media_type?: string
        data?: string
        url?: string
      }
    }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | {
      type: 'tool_result'
      tool_use_id: string
      content: string | AnthropicContentBlock[]
    }

type AnthropicMessage = {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

type OpenAiContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'image_url'
      image_url: { url: string; detail?: 'auto' | 'low' | 'high' }
    }

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | OpenAiContentPart[] | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

export type AnthropicMessagesRequest = {
  model: string
  max_tokens: number
  messages: AnthropicMessage[]
  system?: string | AnthropicContentBlock[]
  tools?: Array<{
    name: string
    description?: string
    input_schema?: Record<string, unknown>
  }>
  stream?: boolean
  temperature?: number
  top_p?: number
  stop_sequences?: string[]
  tool_choice?:
    | { type: 'auto' | 'any' | 'none' }
    | { type: 'tool'; name: string }
}

type OpenAiToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; function: { name: string } }

/** Map an Tovyr tool_choice onto its OpenAI-compatible equivalent. */
function mapToolChoice(
  choice: AnthropicMessagesRequest['tool_choice'],
): OpenAiToolChoice | undefined {
  if (!choice) return undefined
  switch (choice.type) {
    case 'any':
      return 'required'
    case 'none':
      return 'none'
    case 'tool':
      return { type: 'function', function: { name: choice.name } }
    case 'auto':
    default:
      return 'auto'
  }
}

function blocksToText(blocks: AnthropicContentBlock[]): string {
  return blocks
    .map(block => {
      if (block.type === 'text') return block.text
      if (block.type === 'tool_result') {
        const inner =
          typeof block.content === 'string'
            ? block.content
            : blocksToText(block.content)
        return inner
      }
      // Images are not representable as plain text — handled via multimodal parts.
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

/** Convert an Anthropic image block into an OpenAI Chat Completions image_url part. */
export function anthropicImageToOpenAiPart(
  block: Extract<AnthropicContentBlock, { type: 'image' }>,
): OpenAiContentPart | null {
  const src = block.source
  if (!src) return null
  if ((src.type === 'url' || src.type === 'image_url') && src.url) {
    return { type: 'image_url', image_url: { url: src.url } }
  }
  if (src.data) {
    const media = src.media_type || 'image/png'
    return {
      type: 'image_url',
      image_url: { url: `data:${media};base64,${src.data}` },
    }
  }
  if (src.url) {
    return { type: 'image_url', image_url: { url: src.url } }
  }
  return null
}

function collectImageParts(
  blocks: AnthropicContentBlock[],
): OpenAiContentPart[] {
  const parts: OpenAiContentPart[] = []
  for (const block of blocks) {
    if (block.type === 'image') {
      const part = anthropicImageToOpenAiPart(block)
      if (part) parts.push(part)
    } else if (block.type === 'tool_result' && Array.isArray(block.content)) {
      parts.push(...collectImageParts(block.content))
    }
  }
  return parts
}

/**
 * Build OpenAI user `content`: plain string when text-only, multimodal array
 * when images are present (Chat Completions image_url parts).
 */
export function contentToOpenAiUserContent(
  content: string | AnthropicContentBlock[],
): string | OpenAiContentPart[] {
  if (typeof content === 'string') return content

  const parts: OpenAiContentPart[] = []
  for (const block of content) {
    if (block.type === 'text') {
      if (block.text) parts.push({ type: 'text', text: block.text })
    } else if (block.type === 'image') {
      const part = anthropicImageToOpenAiPart(block)
      if (part) parts.push(part)
    } else if (block.type === 'tool_result') {
      const text =
        typeof block.content === 'string'
          ? block.content
          : blocksToText(block.content)
      if (text) parts.push({ type: 'text', text })
      if (Array.isArray(block.content)) {
        parts.push(...collectImageParts(block.content))
      }
    }
  }

  if (parts.length === 0) return ''
  if (parts.length === 1 && parts[0]!.type === 'text') return parts[0]!.text
  return parts
}

function contentToOpenAiParts(
  content: string | AnthropicContentBlock[],
): { text: string; toolCalls: OpenAiMessage['tool_calls'] } {
  if (typeof content === 'string') {
    return { text: content, toolCalls: undefined }
  }

  const textParts: string[] = []
  const toolCalls: NonNullable<OpenAiMessage['tool_calls']> = []

  for (const block of content) {
    if (block.type === 'text') {
      textParts.push(block.text)
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        },
      })
    } else if (block.type === 'tool_result') {
      textParts.push(
        typeof block.content === 'string'
          ? block.content
          : blocksToText(block.content),
      )
    }
    // Assistant turns do not carry image blocks to OpenAI content string;
    // user-side images go through contentToOpenAiUserContent.
  }

  return {
    text: textParts.join('\n'),
    toolCalls: toolCalls.length ? toolCalls : undefined,
  }
}

export function anthropicRequestToOpenAi(
  body: AnthropicMessagesRequest,
): {
  model: string
  max_tokens: number
  messages: OpenAiMessage[]
  stream: boolean
  temperature?: number
  top_p?: number
  stop?: string[]
  tools?: Array<{
    type: 'function'
    function: { name: string; description?: string; parameters?: Record<string, unknown> }
  }>
  tool_choice?: OpenAiToolChoice
  chat_template_kwargs?: { enable_thinking: boolean }
} {
  const messages: OpenAiMessage[] = []

  if (body.system) {
    const systemText =
      typeof body.system === 'string' ? body.system : blocksToText(body.system)
    if (systemText) {
      messages.push({ role: 'system', content: systemText })
    }
  }

  for (const message of body.messages) {
    if (message.role === 'assistant') {
      const { text, toolCalls } = contentToOpenAiParts(message.content)
      messages.push({
        role: 'assistant',
        content: text || (toolCalls ? null : ''),
        ...(toolCalls ? { tool_calls: toolCalls } : {}),
      })
      continue
    }

    const content = message.content
    if (Array.isArray(content)) {
      const toolResults = content.filter(
        (b): b is Extract<AnthropicContentBlock, { type: 'tool_result' }> =>
          b.type === 'tool_result',
      )
      const other = content.filter(b => b.type !== 'tool_result')
      // OpenAI requires that `tool` messages immediately follow the assistant
      // message that issued the tool_calls — any `user` message in between is
      // rejected. So emit the tool results first, then any accompanying user
      // text/images as a fresh user turn.
      for (const tr of toolResults) {
        const toolText =
          typeof tr.content === 'string'
            ? tr.content
            : blocksToText(tr.content)
        messages.push({
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content: toolText,
        })
        // Tool messages are string-only in Chat Completions; surface any
        // embedded images (e.g. Read of a screenshot) as a follow-up user turn.
        if (Array.isArray(tr.content)) {
          const imageParts = collectImageParts(tr.content)
          if (imageParts.length > 0) {
            messages.push({
              role: 'user',
              content: [
                { type: 'text', text: '[Image from tool result]' },
                ...imageParts,
              ],
            })
          }
        }
      }
      if (other.length) {
        const userContent = contentToOpenAiUserContent(other)
        const hasContent =
          typeof userContent === 'string'
            ? userContent.length > 0
            : userContent.length > 0
        if (hasContent) {
          messages.push({ role: 'user', content: userContent })
        }
      }
      continue
    }

    messages.push({ role: 'user', content })
  }

  if (messages.some(message => message.role === 'tool')) {
    const grounding =
      'Tool results are authoritative. When a tool result answers the request, use its returned data and give the final answer now. Do not repeat the same tool call unless the result explicitly reports failure. Never claim information is unavailable when it appears in a tool result.'
    const systemMessage = messages.find(message => message.role === 'system')
    if (systemMessage && typeof systemMessage.content === 'string') {
      systemMessage.content = `${systemMessage.content}\n\n${grounding}`
    } else {
      messages.unshift({ role: 'system', content: grounding })
    }
  }

  const caps = resolveModelCapabilities(body.model, getActiveProviderId())
  const includeTools = Boolean(body.tools?.length) && caps.toolCalling
  // NIM GLM / DeepSeek-R1 default enable_thinking=true and burn 30–90s of CoT
  // before any visible tokens. Force off unless the user opts back in.
  const forceThinkingOff = modelUsesOpenAiThinkingKwargs(body.model)
  const enableThinking =
    forceThinkingOff && process.env.TOVYR_ENABLE_MODEL_THINKING === '1'

  // Casual / no-tools turns do not need 32k completion budgets — smaller caps
  // cut TTFT and stop runaway CoT if a provider ignores enable_thinking.
  const maxTokens = includeTools
    ? capAnthropicMaxTokensForTovyrModel(body)
    : Math.min(capAnthropicMaxTokensForTovyrModel(body), 2048)

  return {
    model: body.model,
    max_tokens: maxTokens,
    messages,
    stream: !!body.stream,
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.top_p !== undefined ? { top_p: body.top_p } : {}),
    ...(body.stop_sequences?.length ? { stop: body.stop_sequences } : {}),
    ...(forceThinkingOff
      ? {
          chat_template_kwargs: {
            enable_thinking: Boolean(enableThinking),
          },
        }
      : {}),
    ...(includeTools
      ? {
          tools: body.tools!.map(tool => ({
            type: 'function' as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.input_schema,
            },
          })),
          // Default to 'auto' so weak models are explicitly told tool calls are
          // allowed; honor an explicit Tovyr tool_choice when provided.
          tool_choice: mapToolChoice(body.tool_choice) ?? 'auto',
        }
      : {}),
  }
}

function appendRecoveredTools(
  content: AnthropicContentBlock[],
  recovered: RecoveredToolUse[],
): void {
  for (const tool of recovered) {
    content.push({
      type: 'tool_use',
      id: tool.id,
      name: tool.name,
      input: tool.input,
    })
  }
}

/** OpenAI-compat reasoning fields used by NIM GLM, DeepSeek-R1, etc. */
function extractReasoningText(source: {
  reasoning_content?: unknown
  reasoning?: unknown
}): string {
  if (typeof source.reasoning_content === 'string') {
    return source.reasoning_content
  }
  if (typeof source.reasoning === 'string') {
    return source.reasoning
  }
  return ''
}

function applyLeakedToolRecovery(content: AnthropicContentBlock[]): void {
  const textParts: string[] = []
  const nonText: AnthropicContentBlock[] = []
  for (const block of content) {
    if (block.type === 'text') {
      textParts.push(block.text)
    } else {
      nonText.push(block)
    }
  }
  if (textParts.length === 0) return

  const merged = textParts.join('\n')
  const { cleanText, toolUses } = recoverLeakedPythonTagTools(merged)
  content.length = 0
  // Keep thinking blocks ahead of recovered text (NIM GLM / DeepSeek order).
  const thinking = nonText.filter(block => block.type === 'thinking')
  const otherNonText = nonText.filter(block => block.type !== 'thinking')
  content.push(...thinking)
  if (cleanText) {
    content.push({ type: 'text', text: cleanText })
  }
  content.push(...otherNonText)
  appendRecoveredTools(content, toolUses)
}

export function openAiCompletionToAnthropic(
  payload: {
    id?: string
    model?: string
    choices?: Array<{
      message?: {
        role?: string
        content?: string | null
        reasoning_content?: string | null
        reasoning?: string | null
        tool_calls?: OpenAiMessage['tool_calls']
      }
      finish_reason?: string | null
    }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  },
  requestModel: string,
): Record<string, unknown> {
  const choice = payload.choices?.[0]
  const message = choice?.message
  const content: AnthropicContentBlock[] = []

  const reasoning = message ? extractReasoningText(message) : ''
  if (reasoning) {
    content.push({ type: 'thinking', thinking: reasoning })
  }

  if (message?.content) {
    content.push({ type: 'text', text: message.content })
  }

  for (const call of message?.tool_calls ?? []) {
    content.push({
      type: 'tool_use',
      id: call.id,
      name: normalizeToolName(call.function.name),
      input: normalizeToolArguments(
        call.function.name,
        parseLooseToolArguments(call.function.arguments),
      ),
    })
  }

  applyLeakedToolRecovery(content)

  // Recovery for models that put tool calls (or whole files) in chat text when
  // they should have used the tool_calls field. Only runs when the turn has no
  // real tool calls and was not truncated. Native tool syntax wins over the
  // fenced-file fallback because it is a far stronger signal of intent.
  if (
    choice?.finish_reason !== 'length' &&
    !content.some(block => block.type === 'tool_use')
  ) {
    const textBlocks = content.filter(
      (b): b is Extract<AnthropicContentBlock, { type: 'text' }> =>
        b.type === 'text',
    )
    const thinkingBlocks = content.filter(
      (b): b is Extract<AnthropicContentBlock, { type: 'thinking' }> =>
        b.type === 'thinking',
    )
    const combined = textBlocks.map(b => b.text).join('\n')
    const { cleanText, toolUses } = recoverAllLeakedToolCalls(combined)
    if (toolUses.length) {
      content.length = 0
      content.push(...thinkingBlocks)
      if (cleanText) content.push({ type: 'text', text: cleanText })
      appendRecoveredTools(content, toolUses)
    }
  }

  // Many OpenAI-compatible providers (NVIDIA NIM, vLLM, llama.cpp, Ollama, …)
  // return finish_reason 'stop' even when they emit tool_calls. Keying solely
  // off finish_reason would map those to 'end_turn', and the Tovyr-side
  // agent would never run the tools. Treat the presence of a tool_use block as
  // authoritative, unless the response was truncated by length.
  const hasToolUse = content.some(block => block.type === 'tool_use')
  const stopReason =
    choice?.finish_reason === 'length'
      ? 'max_tokens'
      : choice?.finish_reason === 'tool_calls' || hasToolUse
        ? 'tool_use'
        : 'end_turn'

  return {
    id: payload.id || `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    model: payload.model || requestModel,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: payload.usage?.prompt_tokens ?? 0,
      output_tokens: payload.usage?.completion_tokens ?? 0,
    },
  }
}

export function anthropicError(
  status: number,
  message: string,
  type = 'api_error',
): Response {
  return new Response(
    JSON.stringify({
      type: 'error',
      error: { type, message },
    }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  )
}

export async function* openAiStreamToAnthropicEvents(
  body: ReadableStream<Uint8Array>,
  requestModel: string,
): AsyncGenerator<string> {
  const messageId = `msg_${Date.now()}`
  let started = false
  let nextIndex = 0
  // Index of the content block currently open (text, thinking, or tool_use), or null.
  let openIndex: number | null = null
  let textOpen = false
  let thinkingOpen = false
  // toolState key of the currently-open tool block, or null when text/thinking/none.
  let openToolIdx: number | null = null
  let finishReason: string | null = null
  let completionTokens = 0
  let promptTokens = 0
  let textAccumulator = ''
  let holdingKvToolLeak = false
  let holdStartedAt = 0
  const HOLD_FLUSH_MS = 2_500
  // Everything actually emitted as visible text, used for end-of-turn recovery
  // of file contents the model dumped into chat instead of calling Write.
  let fullText = ''
  const toolState = new Map<
    number,
    { id: string; name: string; args: string; blockIndex: number }
  >()

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const emit = (event: string, data: Record<string, unknown>) =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

  // Close whatever content block is open. For tool blocks, we buffer the raw
  // argument fragments and emit the repaired JSON as a single input_json_delta
  // here (rather than streaming each fragment), so malformed JSON from weak
  // models is fixed before the agent parses it. Resets all open-block state.
  function* closeOpenBlock(): Generator<string> {
    if (openIndex === null) return
    if (openToolIdx !== null) {
      const st = toolState.get(openToolIdx)
      if (st) {
        const parsed = parseLooseToolArguments(st.args)
        const repaired = JSON.stringify(
          normalizeToolArguments(st.name, parsed),
        )
        yield emit('content_block_delta', {
          type: 'content_block_delta',
          index: st.blockIndex,
          delta: { type: 'input_json_delta', partial_json: repaired },
        })
      }
    }
    yield emit('content_block_stop', {
      type: 'content_block_stop',
      index: openIndex,
    })
    openIndex = null
    textOpen = false
    thinkingOpen = false
    openToolIdx = null
  }

  // Emit message_start exactly once. A well-formed Tovyr stream must open
  // with message_start, so this is also called from finalize() to cover streams
  // that close without ever producing a parseable chunk (provider errors).
  function* ensureStarted(): Generator<string> {
    if (started) return
    started = true
    yield emit('message_start', {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: requestModel,
        stop_reason: null,
        usage: { input_tokens: promptTokens, output_tokens: 0 },
      },
    })
  }

  function* emitTextDelta(text: string): Generator<string> {
    if (!text) return
    fullText += text
    yield* ensureStarted()
    if (!textOpen) {
      yield* closeOpenBlock()
      openIndex = nextIndex++
      textOpen = true
      yield emit('content_block_start', {
        type: 'content_block_start',
        index: openIndex,
        content_block: { type: 'text', text: '' },
      })
    }
    yield emit('content_block_delta', {
      type: 'content_block_delta',
      index: openIndex,
      delta: { type: 'text_delta', text },
    })
  }

  // NIM GLM / DeepSeek-style reasoning streams. Emitting thinking keeps the
  // Anthropic idle watchdog alive and feeds the dock thinking surface.
  function* emitThinkingDelta(text: string): Generator<string> {
    if (!text) return
    yield* ensureStarted()
    if (!thinkingOpen) {
      yield* closeOpenBlock()
      openIndex = nextIndex++
      thinkingOpen = true
      yield emit('content_block_start', {
        type: 'content_block_start',
        index: openIndex,
        content_block: { type: 'thinking', thinking: '' },
      })
    }
    yield emit('content_block_delta', {
      type: 'content_block_delta',
      index: openIndex,
      delta: { type: 'thinking_delta', thinking: text },
    })
  }

  function* emitRecoveredTool(tool: RecoveredToolUse): Generator<string> {
    yield* ensureStarted()
    yield* closeOpenBlock()
    const blockIndex = nextIndex++
    toolState.set(toolState.size, {
      id: tool.id,
      name: tool.name,
      args: JSON.stringify(tool.input),
      blockIndex,
    })
    yield emit('content_block_start', {
      type: 'content_block_start',
      index: blockIndex,
      content_block: {
        type: 'tool_use',
        id: tool.id,
        name: tool.name,
        input: tool.input,
      },
    })
    yield emit('content_block_stop', {
      type: 'content_block_stop',
      index: blockIndex,
    })
    openIndex = null
  }

  function* flushHeldLeakAsText(): Generator<string> {
    if (!textAccumulator) {
      holdingKvToolLeak = false
      holdStartedAt = 0
      return
    }
    const held = textAccumulator
    textAccumulator = ''
    holdingKvToolLeak = false
    holdStartedAt = 0
    yield* emitTextDelta(held)
  }

  function* flushTextAccumulator(): Generator<string> {
    if (!textAccumulator) return
    if (holdingKvToolLeak) {
      if (holdStartedAt && Date.now() - holdStartedAt >= HOLD_FLUSH_MS) {
        yield* flushHeldLeakAsText()
      }
      return
    }
    if (textAccumulator.includes('python_tag')) {
      const { cleanText, toolUses } = recoverLeakedPythonTagTools(textAccumulator)
      textAccumulator = ''
      yield* closeOpenBlock()
      yield* emitTextDelta(cleanText)
      yield* closeOpenBlock()
      for (const tool of toolUses) {
        yield* emitRecoveredTool(tool)
      }
      return
    }
    yield* emitTextDelta(textAccumulator)
    textAccumulator = ''
  }

  function* processIncomingText(chunk: string): Generator<string> {
    textAccumulator += chunk
    if (
      !holdingKvToolLeak &&
      (textAccumulator.includes('<|python_tag|>') ||
        /\bWrite\s+file_path\s*=\s*[`"']/.test(textAccumulator))
    ) {
      holdingKvToolLeak = true
      holdStartedAt = Date.now()
    }
    if (holdingKvToolLeak) {
      if (holdStartedAt && Date.now() - holdStartedAt >= HOLD_FLUSH_MS) {
        yield* flushHeldLeakAsText()
      }
      return
    }
    if (textAccumulator.includes('<|python_tag|>')) {
      const tagIndex = textAccumulator.indexOf('<|python_tag|>')
      const before = textAccumulator.slice(0, tagIndex)
      textAccumulator = textAccumulator.slice(tagIndex)
      if (before) {
        yield* emitTextDelta(before)
      }
      return
    }
    if (textAccumulator.includes('<|')) {
      if (!holdStartedAt) holdStartedAt = Date.now()
      if (Date.now() - holdStartedAt >= HOLD_FLUSH_MS) {
        yield* emitTextDelta(textAccumulator)
        textAccumulator = ''
        holdStartedAt = 0
      }
      return
    }
    holdStartedAt = 0
    yield* flushTextAccumulator()
  }

  // Close any open block, then emit the message-level stop events. Every
  // content_block_start (text OR tool_use) must get a matching stop, otherwise
  // the Tovyr stream is malformed.
  function* finalize(): Generator<string> {
    if (holdingKvToolLeak && textAccumulator) {
      fullText += textAccumulator
      textAccumulator = ''
      holdingKvToolLeak = false
    } else {
      yield* flushTextAccumulator()
    }
    const hadContent =
      nextIndex > 0 || fullText.trim().length > 0 || toolState.size > 0
    yield* ensureStarted()
    if (!hadContent) {
      yield emit('error', {
        type: 'error',
        error: {
          type: 'api_error',
          message: `Model ${requestModel} returned an empty stream (HTTP 200). Check provider health, model id, and context length — or try /model for a different model.`,
        },
      })
      yield emit('message_stop', { type: 'message_stop' })
      return
    }
    yield* closeOpenBlock()
    if (finishReason !== 'length' && toolState.size === 0) {
      const { toolUses } = recoverAllLeakedToolCalls(fullText)
      for (const tool of toolUses) {
        yield* emitRecoveredTool(tool)
      }
    }
    const stopReason =
      finishReason === 'length'
        ? 'max_tokens'
        : finishReason === 'tool_calls' || toolState.size > 0
          ? 'tool_use'
          : 'end_turn'
    yield emit('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: stopReason },
      usage: { input_tokens: promptTokens, output_tokens: completionTokens },
    })
    yield emit('message_stop', { type: 'message_stop' })
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const lineEnd = buffer.indexOf('\n')
      if (lineEnd === -1) break
      const line = buffer.slice(0, lineEnd).trim()
      buffer = buffer.slice(lineEnd + 1)

      if (!line || !line.startsWith('data:')) continue
      const dataStr = line.slice(5).trim()
      if (dataStr === '[DONE]') {
        yield* finalize()
        return
      }

      let chunk: {
        choices?: Array<{
          delta?: {
            content?: string
            reasoning_content?: string
            reasoning?: string
            tool_calls?: Array<{
              index?: number
              id?: string
              function?: { name?: string; arguments?: string }
            }>
          }
          finish_reason?: string | null
        }>
        usage?: { completion_tokens?: number; prompt_tokens?: number }
      }
      try {
        chunk = JSON.parse(dataStr) as typeof chunk
      } catch {
        continue
      }

      if (typeof chunk.usage?.completion_tokens === 'number') {
        completionTokens = chunk.usage.completion_tokens
      }
      if (typeof chunk.usage?.prompt_tokens === 'number') {
        promptTokens = chunk.usage.prompt_tokens
      }

      const choice = chunk.choices?.[0]
      const delta = choice?.delta
      if (choice?.finish_reason) finishReason = choice.finish_reason
      yield* ensureStarted()

      const reasoning = delta ? extractReasoningText(delta) : ''
      if (reasoning) {
        yield* emitThinkingDelta(reasoning)
      }

      if (delta?.content) {
        yield* processIncomingText(delta.content)
      }

      for (const toolDelta of delta?.tool_calls ?? []) {
        const idx = toolDelta.index ?? 0
        let state = toolState.get(idx)
        if (!state) {
          // Close whatever block is currently open (text or a prior tool_use)
          // before opening a new one, and give the new block its own index.
          yield* closeOpenBlock()
          const blockIndex = nextIndex++
          state = {
            id: toolDelta.id || `toolu_${idx}`,
            // Map near-miss names (write_file → Write, shell → Bash, …) to the
            // canonical tool, otherwise the agent loop errors with "tool not
            // found". The name almost always arrives in this first fragment.
            name: normalizeToolName(toolDelta.function?.name || 'tool'),
            args: '',
            blockIndex,
          }
          toolState.set(idx, state)
          openIndex = blockIndex
          openToolIdx = idx
          yield emit('content_block_start', {
            type: 'content_block_start',
            index: blockIndex,
            content_block: {
              type: 'tool_use',
              id: state.id,
              name: state.name,
              input: {},
            },
          })
        }
        if (toolDelta.id) state.id = toolDelta.id
        // Buffer the argument fragments; the repaired JSON is emitted as one
        // input_json_delta when the block closes (see closeOpenBlock).
        if (toolDelta.function?.arguments) {
          state.args += toolDelta.function.arguments
        }
      }
    }
  }

  yield* finalize()
}

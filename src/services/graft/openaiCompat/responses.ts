import type { anthropicRequestToOpenAi } from './convert.js'

type ChatRequest = ReturnType<typeof anthropicRequestToOpenAi>
type Item = Record<string, any>

export function usesResponsesApi(providerId: string | undefined, model: string): boolean {
  return providerId === 'openai' && /^gpt-6-astra(?:-|$)/i.test(model)
}

/** Stateless Responses requests: preserve tool call IDs and never store a remote conversation. */
export function chatToResponses(body: ChatRequest) {
  const input: Item[] = []
  for (const message of body.messages) {
    if (message.role === 'tool') {
      input.push({ type: 'function_call_output', call_id: message.tool_call_id, output: message.content ?? '' })
      continue
    }
    if (message.content) {
      const content = typeof message.content === 'string' ? message.content : message.content.map(part =>
        part.type === 'image_url'
          ? { type: 'input_image', image_url: part.image_url.url, detail: part.image_url.detail ?? 'auto' }
          : { type: message.role === 'assistant' ? 'output_text' : 'input_text', text: part.text },
      )
      input.push({ role: message.role, content })
    }
    for (const call of message.tool_calls ?? []) {
      input.push({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments })
    }
  }
  return {
    model: body.model, input, stream: body.stream, store: false,
    max_output_tokens: body.max_completion_tokens ?? body.max_tokens,
    reasoning: { effort: 'low' },
    ...(body.tools?.length ? { tools: body.tools.map(tool => ({ type: 'function', ...tool.function, strict: false })) } : {}),
    ...(body.tool_choice ? { tool_choice: typeof body.tool_choice === 'string' ? body.tool_choice : { type: 'function', name: body.tool_choice.function.name } } : {}),
  }
}

export function responseToChat(payload: Item) {
  if (payload.status === 'failed' || payload.error) throw new Error('The provider reported a failed Responses request.')
  const items: Item[] = payload.output ?? []
  const calls = items.filter(item => item.type === 'function_call').map(item => ({ id: item.call_id, type: 'function', function: { name: item.name, arguments: item.arguments } }))
  const text = items.filter(item => item.type === 'message').flatMap(item => item.content ?? []).filter(part => part.type === 'output_text' || part.type === 'refusal').map(part => part.text ?? part.refusal ?? '').join('')
  return {
    id: payload.id,
    choices: [{ message: { content: text, ...(calls.length ? { tool_calls: calls } : {}) }, finish_reason: payload.status === 'incomplete' ? 'length' : calls.length ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: payload.usage?.input_tokens ?? 0, completion_tokens: payload.usage?.output_tokens ?? 0 },
  }
}

/** Translate Responses events into the existing, tested chat-to-Ink stream path. */
export function responsesToChatStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffered = ''
  let completed = false
  const calls = new Map<number, { index: number; argumentsSeen: boolean }>()
  const emit = (controller: TransformStreamDefaultController<Uint8Array>, delta: Item, finish_reason: string | null = null, usage?: Item) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason }], ...(usage ? { usage } : {}) })}\n\n`))
  }
  const line = (raw: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    if (!raw.startsWith('data:')) return
    const data = raw.slice(5).trim()
    if (!data || data === '[DONE]') return
    const event = JSON.parse(data) as Item
    if (event.type === 'error' || event.type === 'response.failed') throw new Error('The provider reported a failed Responses stream.')
    if (event.type === 'response.output_text.delta') emit(controller, { content: event.delta })
    if (event.type === 'response.refusal.delta') emit(controller, { content: event.delta })
    if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
      const call = { index: calls.size, argumentsSeen: Boolean(event.item.arguments) }
      calls.set(event.output_index, call)
      emit(controller, { tool_calls: [{ index: call.index, id: event.item.call_id, type: 'function', function: { name: event.item.name, arguments: event.item.arguments ?? '' } }] })
    }
    if (event.type === 'response.function_call_arguments.delta') {
      const call = calls.get(event.output_index)
      if (!call) throw new Error('Tool argument stream arrived without its function call.')
      call.argumentsSeen = true
      emit(controller, { tool_calls: [{ index: call.index, function: { arguments: event.delta } }] })
    }
    if (event.type === 'response.function_call_arguments.done') {
      const call = calls.get(event.output_index)
      if (call && !call.argumentsSeen) emit(controller, { tool_calls: [{ index: call.index, function: { arguments: event.arguments ?? '' } }] })
    }
    if (event.type === 'response.completed' || event.type === 'response.incomplete') {
      completed = true
      emit(controller, {}, event.type === 'response.incomplete' ? 'length' : calls.size ? 'tool_calls' : 'stop', {
        prompt_tokens: event.response?.usage?.input_tokens ?? 0,
        completion_tokens: event.response?.usage?.output_tokens ?? 0,
      })
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    }
  }
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffered += decoder.decode(chunk, { stream: true })
      const lines = buffered.split(/\r?\n/)
      buffered = lines.pop() ?? ''
      for (const raw of lines) line(raw, controller)
      if (buffered.length > 2_000_000) throw new Error('Responses stream event exceeded the size limit.')
    },
    flush(controller) {
      buffered += decoder.decode()
      if (buffered.trim()) line(buffered, controller)
      if (!completed) throw new Error('Responses stream ended before completion. Retry the request.')
    },
  }))
}

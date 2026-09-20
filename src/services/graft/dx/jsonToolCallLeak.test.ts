import { describe, expect, test } from 'bun:test'
import {
  filterGraftAssistantDisplayText,
  filterGraftStreamingPreview,
  isJsonToolCallLeak,
  jsonToolCallLeakOpenCodeLine,
  parseJsonToolCallLeak,
  shouldHideGraftAssistantText,
} from './chatTextFilter.js'

/** Verbatim from a Llama 3.1 8B Instruct turn on NVIDIA NIM. */
const LEAKED_ASK = `{"name": "AskUserQuestion", "parameters": {"questions":[{"header":"Next step","multiSelect":true,"options":[{"description":"","label":"Code a website","options":[]},{"description":"","label":"Help with existing website","options":[]}]},{"header":"","multiSelect":false,"options":[{"description":"Please provide more context about the website you want to code."}]}],"metadata":{}}}`

describe('leaked JSON tool calls never render as prose', () => {
  test('recognises the whole-message JSON tool call', () => {
    expect(isJsonToolCallLeak(LEAKED_ASK)).toBe(true)
    expect(parseJsonToolCallLeak(LEAKED_ASK)?.toolName).toBe('AskUserQuestion')
    expect(parseJsonToolCallLeak(LEAKED_ASK)?.prose).toBe('')
  })

  test('hides it from the transcript instead of printing raw JSON', () => {
    expect(shouldHideGraftAssistantText(LEAKED_ASK)).toBe(true)
    expect(filterGraftAssistantDisplayText(LEAKED_ASK)).toBe('')
  })

  test('never previews a partially streamed tool call', () => {
    expect(filterGraftStreamingPreview(LEAKED_ASK)).toBeNull()
    expect(filterGraftStreamingPreview('{"name": "AskUserQ')).toBeNull()
  })

  test('renders a tool row standing in for the call', () => {
    const line = jsonToolCallLeakOpenCodeLine(LEAKED_ASK)
    expect(line).not.toBeNull()
    expect(line?.text).toContain('AskUserQuestion')
  })

  test('keeps surrounding prose when the model mixes text and a tool call', () => {
    const mixed = `<tool_call>{"name": "Read", "arguments": {"file_path": "a.ts"}}</tool_call>`
    expect(parseJsonToolCallLeak(mixed)?.toolName).toBe('Read')
  })

  test('leaves ordinary prose and real JSON answers alone', () => {
    const prose = 'Here is the plan. I will start with the header component.'
    expect(isJsonToolCallLeak(prose)).toBe(false)
    expect(filterGraftAssistantDisplayText(prose)).toBe(prose)
    // A JSON code answer has no tool "name"/arguments pair.
    const jsonAnswer = '{"total": 3, "items": ["a", "b"]}'
    expect(isJsonToolCallLeak(jsonAnswer)).toBe(false)
  })
})

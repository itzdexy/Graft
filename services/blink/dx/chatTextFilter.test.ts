import { describe, expect, test } from 'bun:test'
import {
  filterBlinkStreamingPreview,
  filterBlinkAssistantDisplayText,
  isBillingHeaderLeak,
  isPseudoFunctionToolLeak,
  matchNarratedToolIntent,
  narratedToolOpenCodeLine,
  parsePseudoFunctionToolCall,
  pseudoFunctionOpenCodeLine,
  resolveBlinkWriteDisplayPath,
  shouldHideBlinkAssistantText,
} from './chatTextFilter.js'

describe('chatTextFilter', () => {
  test('detects billing header leak', () => {
    expect(
      isBillingHeaderLeak(
        'x-anthropic-billing-header: cc_version=1.0.7.153; cc_entrypoint=cli;',
      ),
    ).toBe(true)
  })

  test('detects narrated Write tool', () => {
    expect(
      matchNarratedToolIntent(
        'Using the Write tool to create a basic SaaS dashboard template...',
      )?.toolName,
    ).toBe('Write')
  })

  test('hides billing-only assistant text', () => {
    expect(
      shouldHideBlinkAssistantText(
        'x-anthropic-billing-header: cc_version=1.0.7.153; cc_entrypoint=cli;',
      ),
    ).toBe(true)
  })

  test('hides narrated tool-only text', () => {
    expect(
      shouldHideBlinkAssistantText(
        'Using the Write tool to create a basic SaaS dashboard template...',
      ),
    ).toBe(true)
  })

  test('keeps normal conversational text', () => {
    expect(shouldHideBlinkAssistantText('Hi!')).toBe(false)
  })

  test('rewrites no-task fallback for greetings', () => {
    expect(
      filterBlinkAssistantDisplayText('There is no task to complete.'),
    ).toBe('Hi - what can I help you with today?')
    expect(
      filterBlinkAssistantDisplayText(
        'Blink There is no task to complete.',
      ),
    ).toBe('Hi - what can I help you with today?')
  })

  test('narrated tool maps to OpenCode line', () => {
    const line = narratedToolOpenCodeLine(
      'Using the Write tool to create dashboard.html',
    )
    expect(line?.prefix).toBe('○')
    expect(line?.text).toContain('Write')
  })

  test('pseudo Write maps landing page to landing_page.html', () => {
    const line = pseudoFunctionOpenCodeLine(
      'Write(file_path="index.html", content="landing page template")',
      true,
    )
    expect(line?.text).toContain('landing_page.html')
  })

  test('resolveBlinkWriteDisplayPath prefers landing_page for landing prompts', () => {
    expect(
      resolveBlinkWriteDisplayPath('index.html', 'code me a landing page'),
    ).toBe('landing_page.html')
  })

  test('hides pseudo-function Write leak', () => {
    const leak =
      'Write(file_path="D:\\\\New folder\\\\index.html", content="...")'
    expect(isPseudoFunctionToolLeak(leak)).toBe(true)
    expect(shouldHideBlinkAssistantText(leak)).toBe(true)
    const line = pseudoFunctionOpenCodeLine(leak, true)
    expect(line?.prefix).toBe('○')
    expect(line?.text).toContain('index.html')
  })

  test('parsePseudoFunctionToolCall extracts basename', () => {
    const parsed = parsePseudoFunctionToolCall(
      'Write(file_path="src/pages/home.tsx", content="...")',
    )
    expect(parsed?.toolName).toBe('Write')
    expect(parsed?.input.file_path).toBe('home.tsx')
  })

  test('filters streaming preview for pseudo Write', () => {
    expect(
      filterBlinkStreamingPreview(
        'Write(file_path="index.html", content="<!DOCTYPE html>")',
      ),
    ).toBe(null)
  })

  test('filters billing header from streaming preview', () => {
    expect(
      filterBlinkStreamingPreview(
        'x-anthropic-billing-header: cc_version=1.0.7;',
      ),
    ).toBe(null)
  })
})

import { describe, expect, test } from 'bun:test'
import {
  projectToolError,
  projectWebToolResult,
  stripModelDirectedGuidance,
} from './toolResultPresentation.js'

describe('Tovyr tool result presentation', () => {
  test('uses real web metadata and bounds expanded output', () => {
    const result = projectWebToolResult(
      {
        action: 'search',
        output: `Web search\n\n${'result line\n'.repeat(200)}`,
        activity: {
          operation: 'search',
          query: 'Tovyr docs',
          resultCount: 8,
          sourceHosts: ['github.com', 'docs.example.com'],
        },
      },
      420,
    )
    expect(result.summary).toBe('8 results · github.com, docs.example.com')
    expect(result.detail.length).toBeLessThanOrEqual(421)
    expect(result.truncated).toBe(true)
    expect(result.detail).toEndWith('…')
  })

  test('does not invent a result count when metadata has none', () => {
    const result = projectWebToolResult({
      action: 'read',
      output: 'Fetched https://example.com\n\nPage body',
      activity: { operation: 'read', sourceHost: 'example.com' },
    })
    expect(result.summary).toBe('example.com')
    expect(result.summary).not.toMatch(/\d+ results/)
  })

  test('reduces shell stacks to the actionable error and identifier', () => {
    const error = projectToolError(
      `Get-ChildItem: A parameter cannot be found that matches parameter name 'Forcee'.\nAt line:1 char:22\n+ Get-ChildItem -Forcee\n+                      ~~~~~~~\nCategoryInfo : InvalidArgument\nFullyQualifiedErrorId : NamedParameterNotFound`,
    )
    expect(error.summary).toContain("parameter name 'Forcee'")
    expect(error.detail).toContain('NamedParameterNotFound')
    expect(error.detail).not.toContain('At line:1')
    expect(error.detail).not.toContain('~~~~')
  })

  test('preserves angle-bracket diagnostics while removing transport wrappers', () => {
    const error = projectToolError(
      '<tool_use_error><error>Type Foo<T> cannot satisfy Bar<U>.\n<identifier> expected.</error></tool_use_error>',
    )

    expect(error.summary).toContain('Foo<T>')
    expect(error.detail).toContain('Bar<U>')
    expect(error.detail).toContain('<identifier> expected')
    expect(error.detail).not.toContain('tool_use_error')
    expect(error.detail).not.toContain('<error>')
  })
})

describe('stripModelDirectedGuidance dangling headers', () => {
  test('keeps the enumeration when it is the only substance', () => {
    // Stripping produced "Agent failed due to the following issue:" with
    // nothing after the colon — a failure that names no failure.
    const raw =
      'InputValidationError: Agent failed due to the following issue:\n\nAvailable agents: general-purpose, Explore, Plan'
    expect(stripModelDirectedGuidance(raw)).toBe(raw)
  })

  test('still strips the enumeration when a real failure precedes it', () => {
    expect(
      stripModelDirectedGuidance(
        'File not found: a.ts\n\nAvailable tools: Read, Write',
      ),
    ).toBe('File not found: a.ts')
  })

  test('a trailing dash also counts as dangling', () => {
    const raw = 'Could not start the agent —\n\nValid options: a, b'
    expect(stripModelDirectedGuidance(raw)).toBe(raw)
  })

  test('an ordinary message is untouched', () => {
    expect(stripModelDirectedGuidance('Permission denied')).toBe(
      'Permission denied',
    )
  })
})

import { describe, expect, test } from 'bun:test'
import { z } from 'zod/v4'
import { validateMcpToolArguments } from './mcp.js'

describe('MCP tool argument validation', () => {
  const schema = z.object({
    path: z.string().min(1),
    recursive: z.boolean().optional(),
  })

  test('returns parsed arguments for a valid request', () => {
    expect(validateMcpToolArguments('Read', schema, { path: 'src' })).toEqual({
      path: 'src',
    })
  })

  test('rejects malformed arguments before tool execution', () => {
    expect(() =>
      validateMcpToolArguments('Read', schema, { path: 42 }),
    ).toThrow(/Tool Read input is invalid/)
  })
})
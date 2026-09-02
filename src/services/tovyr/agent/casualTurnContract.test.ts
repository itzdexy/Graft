import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const query = readFileSync(join(process.cwd(), 'src', 'query.ts'), 'utf8')

/**
 * A parked mission must not reach the model on a casual turn. The pause used
 * to run only from the chat dock, so the brief was already in the system
 * prompt by the time it fired and "hi" came back as "You wanted a website…".
 */
describe('casual turns drop the agent mission brief', () => {
  test('query pauses a casual session before assembling the prompt', () => {
    const pause = query.indexOf('pauseAgentSessionIfCasual(casualCheckPrompt)')
    const inject = query.indexOf('formatAgentSessionSystemSection(agentSession!)')

    expect(pause).toBeGreaterThan(0)
    expect(inject).toBeGreaterThan(0)
    // Ordering is the fix: pausing after injection changes nothing.
    expect(pause).toBeLessThan(inject)
  })

  test('the brief is skipped entirely once the session is idle', () => {
    expect(query).toContain('hasActiveTovyrAgentSession()')
    expect(query).toContain(
      'const agentSession = hasActiveTovyrAgentSession()',
    )
  })
})

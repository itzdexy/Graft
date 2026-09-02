import { describe, expect, test } from 'bun:test'
import { deriveTurnActivity } from './activityAdapter.js'

describe('deriveTurnActivity', () => {
  test('uses permission as the single visible live state', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'tool-use',
        permissionPending: true,
        activeTool: { name: 'Bash', summary: 'npm test' },
      }),
    ).toMatchObject({
      kind: 'waiting_for_permission',
      label: 'Approval needed · Continue the requested action',
    })
  })

  test('shows a real web search query without inventing a result count', () => {
    const activity = deriveTurnActivity({
      at: 1,
      isLoading: true,
      streamMode: 'tool-use',
      activeTool: {
        name: 'TovyrWeb',
        summary: 'NVIDIA NIM docs',
        web: { operation: 'search', query: 'NVIDIA NIM docs' },
      },
    })

    expect(activity).toMatchObject({
      kind: 'searching',
      label: 'Search · NVIDIA NIM docs',
    })
    expect(activity?.label).not.toMatch(/\d+ results/)
  })

  test('shows source host for a real read operation', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'tool-use',
        activeTool: {
          name: 'TovyrWeb',
          summary: 'docs.nvidia.com',
          web: { operation: 'read', sourceHost: 'docs.nvidia.com' },
        },
      }),
    ).toMatchObject({ kind: 'reading_source', label: 'Read · docs.nvidia.com' })
  })

  test('recognizes built-in WebSearch input as a semantic search activity', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'tool-use',
        activeTool: {
          name: 'WebSearch',
          summary: 'web request',
          input: { query: '  Bun shell official docs  ' },
        },
      }),
    ).toMatchObject({
      kind: 'searching',
      label: 'Search · Bun shell official docs',
    })
  })

  test('recognizes built-in WebFetch URL and reports only its real host', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'tool-use',
        activeTool: {
          name: 'WebFetch',
          summary: 'web request',
          input: {
            url: 'https://docs.nvidia.com/nim/guide?view=latest',
            prompt: 'Read the setup section',
          },
        },
      }),
    ).toMatchObject({
      kind: 'reading_source',
      label: 'Read · docs.nvidia.com',
    })
  })

  test('keeps an invalid WebFetch target honest instead of inventing a host', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'tool-use',
        activeTool: {
          name: 'WebFetch',
          summary: 'web request',
          input: { url: 'not a valid url' },
        },
      }),
    ).toMatchObject({
      kind: 'reading_source',
      label: 'Read · not a valid url',
    })
  })

  test('keeps TovyrWeb search and read activity semantics', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'tool-use',
        activeTool: {
          name: 'TovyrWeb',
          input: { action: 'search', target: 'Ink terminal layout' },
        },
      }),
    ).toMatchObject({ kind: 'searching', label: 'Search · Ink terminal layout' })

    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'tool-use',
        activeTool: {
          name: 'TovyrWeb',
          input: { action: 'read', target: 'https://github.com/itzdexy/Tovyr' },
        },
      }),
    ).toMatchObject({ kind: 'reading_source', label: 'Read · github.com' })
  })

  test('maps thinking and idle without fabricating work', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'thinking',
        thinkingLabel: 'Tracing the provider path',
      })?.kind,
    ).toBe('thinking')
    expect(
      deriveTurnActivity({ at: 1, isLoading: false, streamMode: 'responding' }),
    ).toBeNull()
  })

  test('distinguishes editing from generic tool execution', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'tool-use',
        activeTool: { name: 'Edit', summary: 'src/app.tsx' },
      }),
    ).toMatchObject({ kind: 'coding', label: 'Edit · src/app.tsx' })
  })

  test('shows a real streaming state once response text arrives', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'responding',
        hasStreamingText: true,
      }),
    ).toMatchObject({ kind: 'streaming', label: 'Streaming response' })
  })

  test('names ideation and planning phases without fake progress', () => {
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'requesting',
        orchestrationState: 'ideating',
      }),
    ).toMatchObject({ kind: 'ideating', label: 'Shaping approaches' })
    expect(
      deriveTurnActivity({
        at: 1,
        isLoading: true,
        streamMode: 'requesting',
        orchestrationState: 'drafting_plan',
      }),
    ).toMatchObject({ kind: 'planning', label: 'Drafting the plan' })
  })
})

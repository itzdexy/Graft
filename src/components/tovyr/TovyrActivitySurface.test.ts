import { describe, expect, test } from 'bun:test'
import { projectActivitySurface } from './TovyrActivitySurface.js'

const activity = {
  kind: 'searching' as const,
  status: 'active' as const,
  label: 'Search · NVIDIA NIM docs',
  startedAt: 0,
  updatedAt: 0,
  evidence: [],
}

describe('projectActivitySurface', () => {
  test('uses motion frames only for a real active state', () => {
    expect(projectActivitySurface(activity, 1, false)).toMatchObject({
      icon: '⌕',
      marker: '⠙',
      label: 'Search · NVIDIA NIM docs',
      animate: true,
    })
  })

  test('keeps full state text when motion is reduced', () => {
    expect(projectActivitySurface(activity, 3, true)).toEqual({
      icon: '⌕',
      marker: ' ',
      label: 'Search · NVIDIA NIM docs',
      detail: undefined,
      color: 'tovyrPrimary',
      animate: false,
    })
  })

  test('renders permission and failure as unmistakable text states', () => {
    expect(
      projectActivitySurface(
        { ...activity, kind: 'waiting_for_permission', label: 'Approval needed' },
        0,
        false,
      ),
    ).toMatchObject({ icon: '⚠', marker: ' ', color: 'warning', animate: false })
    expect(
      projectActivitySurface(
        { ...activity, kind: 'failed', status: 'failed', label: 'Model failed' },
        0,
        false,
      ),
    ).toMatchObject({ icon: '✗', marker: ' ', color: 'error', animate: false })
  })

  test('gives coding, streaming, and thinking distinct purposeful loops', () => {
    const base = { ...activity, label: 'Working' }
    expect(
      projectActivitySurface({ ...base, kind: 'coding' }, 2, false),
    ).toMatchObject({ icon: '✎', marker: '⠹', animate: true })
    expect(
      projectActivitySurface({ ...base, kind: 'streaming' }, 2, false),
    ).toMatchObject({ icon: '▪', marker: '▅', animate: true })
    expect(
      projectActivitySurface({ ...base, kind: 'thinking' }, 2, false),
    ).toMatchObject({ icon: '◐', marker: '⠹', animate: true })
  })

  test('keeps every animated marker one terminal cell wide', () => {
    const kinds = [
      'ideating',
      'planning',
      'thinking',
      'searching',
      'reading_source',
      'coding',
      'running_tool',
      'streaming',
      'handoff',
      'verifying',
      'recovering',
    ] as const
    for (const kind of kinds) {
      for (let frame = 0; frame < 12; frame++) {
        expect(projectActivitySurface({ ...activity, kind }, frame, false).marker.length).toBe(1)
      }
    }
  })

  test('fits the activity copy without changing the fixed two-cell motion prefix', () => {
    expect(
      projectActivitySurface(
        {
          ...activity,
          label: 'Search query',
          detail: 'example.com',
        },
        0,
        true,
        8,
      ),
    ).toMatchObject({
      icon: '⌕',
      marker: ' ',
      label: 'Search …',
      detail: undefined,
    })
  })

  test('uses remaining narrow-row width for bounded detail text', () => {
    expect(
      projectActivitySurface(
        {
          ...activity,
          label: 'Read',
          detail: 'example.com',
        },
        0,
        true,
        12,
      ),
    ).toMatchObject({
      label: 'Read',
      detail: 'exam…',
    })
  })
})

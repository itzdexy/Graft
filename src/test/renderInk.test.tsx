import { describe, expect, test } from 'bun:test'
import * as React from 'react'
import { Box, Text } from '../ink.js'
import { renderToText, stripAnsi } from './renderInk.js'

function EnvReader() {
  return React.createElement(Text, null, process.env.RENDER_HARNESS_TEST ?? 'missing')
}

function UpdatingText() {
  const [value, setValue] = React.useState('changed')
  React.useEffect(() => {
    const timer = setTimeout(() => setValue('updated'), 10)
    return () => clearTimeout(timer)
  }, [])
  return React.createElement(Text, null, `stable ${value}`)
}

function ThrowingEffectCleanup() {
  React.useEffect(() => () => {
    throw new Error('cleanup failed')
  }, [])
  return React.createElement(Text, null, 'cleanup')
}

function RowPressure() {
  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Text, null, 'row one'),
    React.createElement(Text, null, 'row two'),
    React.createElement(Text, null, 'row three'),
  )
}

describe('ink render harness', () => {
  test('paints plain text', async () => {
    const { output } = await renderToText(
      React.createElement(Text, null, 'hello from ink'),
    )
    expect(output).toContain('hello from ink')
  })

  test('returns the last painted frame separately', async () => {
    const result = await renderToText(React.createElement(Text, null, 'ready'))
    expect(result.lastFrame).toContain('ready')
  })

  test('restores terminal environment overrides', async () => {
    const before = process.env.NO_COLOR
    const result = await renderToText(React.createElement(EnvReader), {
      env: { RENDER_HARNESS_TEST: 'active' },
    })
    expect(result.output).toContain('active')
    expect(process.env.RENDER_HARNESS_TEST).toBeUndefined()
    expect(process.env.NO_COLOR).toBe(before)
  })

  test('restores environment when rendering throws', async () => {
    const Broken = () => {
      throw new Error('render failed')
    }
    const result = await renderToText(React.createElement(Broken), {
      env: { RENDER_HARNESS_TEST: 'active' },
    })
    expect(result.output).toContain('render failed')
    expect(process.env.RENDER_HARNESS_TEST).toBeUndefined()
  })

  test('captures unchanged and changed content after an update', async () => {
    const result = await renderToText(React.createElement(UpdatingText))
    expect(result.lastFrame).toContain('stable')
    expect(result.lastFrame).toContain('updated')
  })

  test('cleans up an effect that throws without leaking environment or hanging', async () => {
    const started = Date.now()
    const result = await renderToText(React.createElement(ThrowingEffectCleanup), {
      env: { RENDER_HARNESS_TEST: 'active' },
    })
    expect(result.output).toContain('cleanup')
    expect(process.env.RENDER_HARNESS_TEST).toBeUndefined()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  test('passes terminal columns to Ink layout', async () => {
    const result = await renderToText(
      React.createElement(Text, null, 'abcdefghij'),
      { columns: 5, rows: 2 },
    )
    expect(result.output).toContain('abcde')
    expect(result.output).toContain('fghij')
  })

  test('keeps private control sequences out of the authoritative final frame', async () => {
    const result = await renderToText(React.createElement(Text, null, 'clean'))
    expect(result.lastFrame).toContain('clean')
    expect(result.lastFrame).not.toMatch(/\u001b\[[0-9;?<>]*[A-Za-z]/)
  })

  test('bounds final frame rows under terminal pressure', async () => {
    const result = await renderToText(React.createElement(RowPressure), {
      columns: 30,
      rows: 2,
    })
    expect(result.lastFrame.split('\n').length).toBeLessThanOrEqual(2)
    expect(result.lastFrame).toContain('row one')
  })

  test('restores env when the renderer itself rejects', async () => {
    const renderImpl = async () => {
      throw new Error('renderer rejected')
    }
    const started = Date.now()
    await expect(
      renderToText(React.createElement(Text, null, 'never'), {
        env: { RENDER_HARNESS_TEST: 'active' },
        renderImpl,
      }),
    ).rejects.toThrow('renderer rejected')
    expect(process.env.RENDER_HARNESS_TEST).toBeUndefined()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  test('restores a pre-existing environment value', async () => {
    const previous = process.env.RENDER_HARNESS_TEST
    process.env.RENDER_HARNESS_TEST = 'before'
    try {
      const result = await renderToText(React.createElement(EnvReader), {
        env: { RENDER_HARNESS_TEST: 'during' },
      })
      expect(result.output).toContain('during')
      expect(process.env.RENDER_HARNESS_TEST).toBe('before')
    } finally {
      if (previous === undefined) delete process.env.RENDER_HARNESS_TEST
      else process.env.RENDER_HARNESS_TEST = previous
    }
  })

  test('normalizes zero and huge terminal dimensions', async () => {
    const zero = await renderToText(React.createElement(Text, null, 'zero'), {
      columns: 0,
      rows: 0,
    })
    const huge = await renderToText(React.createElement(Text, null, 'huge'), {
      columns: Number.MAX_SAFE_INTEGER,
      rows: Number.MAX_SAFE_INTEGER,
    })
    expect(zero.lastFrame).toContain('z')
    expect(huge.lastFrame).toContain('huge')
    expect(huge.lastFrame).not.toMatch(/\u001b\[/)
  })

  test('paints nested boxes', async () => {
    const { output } = await renderToText(
      React.createElement(
        Box,
        { flexDirection: 'column' },
        React.createElement(Text, null, 'first line'),
        React.createElement(Text, null, 'second line'),
      ),
    )
    expect(output).toContain('first line')
    expect(output).toContain('second line')
  })

  test('stripAnsi removes styling but keeps text', () => {
    expect(stripAnsi('\u001B[31mred\u001B[39m')).toBe('red')
  })
})

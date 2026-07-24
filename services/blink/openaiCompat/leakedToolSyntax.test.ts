import { describe, expect, test } from 'bun:test'
import {
  recoverLeakedPythonTagTools,
  recoverKeyValueToolCalls,
  recoverAllLeakedToolCalls,
  recoverNarratedFileWrites,
  recoverNativeToolCalls,
  stripLeakedPythonTagMarkup,
} from './leakedToolSyntax.js'
import { openAiCompletionToAnthropic } from './convert.js'

describe('recoverLeakedPythonTagTools', () => {
  test('maps touch html to Write with boilerplate', () => {
    const { cleanText, toolUses } = recoverLeakedPythonTagTools(
      '<|python_tag|>touch index.html',
    )
    expect(cleanText).toBe('')
    expect(toolUses).toHaveLength(1)
    expect(toolUses[0]?.name).toBe('Write')
    expect(toolUses[0]?.input).toMatchObject({
      file_path: 'index.html',
      content: expect.stringContaining('<!DOCTYPE html>'),
    })
  })

  test('maps echo redirect to Write', () => {
    const { toolUses } = recoverLeakedPythonTagTools(
      `<|python_tag|>echo "<html></html>" > index.html`,
    )
    expect(toolUses[0]?.name).toBe('Write')
    expect(toolUses[0]?.input).toEqual({
      file_path: 'index.html',
      content: '<html></html>',
    })
  })

  test('stripLeakedPythonTagMarkup removes orphan tags', () => {
    expect(stripLeakedPythonTagMarkup('hello <|python_tag|>')).toBe('hello')
  })
})

describe('recoverNarratedFileWrites', () => {
  test('recovers a fenced html block with a default filename when prose asks to create one', () => {
    const text =
      'Sure, I will create a basic HTML page:\n\n```html\n<!DOCTYPE html>\n<html><body>Hi</body></html>\n```'
    const { toolUses } = recoverNarratedFileWrites(text)
    expect(toolUses).toHaveLength(1)
    expect(toolUses[0]?.name).toBe('Write')
    expect(toolUses[0]?.input).toMatchObject({
      file_path: 'index.html',
      content: expect.stringContaining('<!DOCTYPE html>'),
    })
  })

  test('uses an explicit filename from the info string', () => {
    const text = '```styles.css\nbody { margin: 0; }\n```'
    const { toolUses } = recoverNarratedFileWrites(text)
    expect(toolUses[0]?.input).toMatchObject({ file_path: 'styles.css' })
  })

  test('uses a filename mentioned just before the fence', () => {
    const text = 'Save this as app.js:\n```\nconsole.log(1)\nconsole.log(2)\n```'
    const { toolUses } = recoverNarratedFileWrites(text)
    expect(toolUses[0]?.input).toMatchObject({ file_path: 'app.js' })
  })

  test('ignores trivial inline snippets with no filename', () => {
    const { toolUses } = recoverNarratedFileWrites('run `ls -la` to list files')
    expect(toolUses).toHaveLength(0)
  })

  test('does not treat version numbers as filenames', () => {
    const text = 'Create this page (built with llama-3.1):\n```html\n<h1>x</h1>\n<p>y</p>\n```'
    const { toolUses } = recoverNarratedFileWrites(text)
    expect(toolUses[0]?.input).toMatchObject({ file_path: 'index.html' })
  })
})

describe('recoverKeyValueToolCalls', () => {
  test('parses Write file_path=… content=… with spaced Windows paths', () => {
    const text = `● Write file_path=D:\\New folder (2)\\New folder\\index.html content=

Basic HTML Template

Welcome to the basic HTML template!`
    const { cleanText, toolUses } = recoverKeyValueToolCalls(text)
    expect(cleanText).toBe('')
    expect(toolUses).toHaveLength(1)
    expect(toolUses[0]?.name).toBe('Write')
    expect(toolUses[0]?.input).toMatchObject({
      file_path: 'index.html',
      content: expect.stringContaining('Basic HTML Template'),
    })
  })

  test('parses comma-separated file_path, content= with literal \\n', () => {
    const text =
      'Write file_path=D:\\proj\\index.html, content=\\n \\n Basic HTML Page\\n\\nWelcome!'
    const { toolUses } = recoverKeyValueToolCalls(text)
    expect(toolUses).toHaveLength(1)
    expect(toolUses[0]?.input).toMatchObject({
      file_path: 'index.html',
      content: expect.stringContaining('Basic HTML Page'),
    })
  })

  test('dedupes repeated identical Write leaks', () => {
    const block =
      'Write file_path=index.html content=\n<h1>Hi</h1>\n'
    const text = `${block}\n${block}\n${block}`
    const { toolUses } = recoverKeyValueToolCalls(text)
    expect(toolUses).toHaveLength(1)
  })
})

describe('recoverAllLeakedToolCalls', () => {
  test('prefers key-value Write over narrated fence fallback', () => {
    const text =
      'Write file_path=app.html content=\n<!DOCTYPE html><html></html>'
    const { toolUses } = recoverAllLeakedToolCalls(text)
    expect(toolUses[0]?.input).toMatchObject({ file_path: 'app.html' })
  })
})

describe('recoverNativeToolCalls', () => {
  test('parses Llama <function=NAME>{json}</function> and normalizes the name', () => {
    const text =
      '<function=write_file>{"file_path":"a.html","content":"<h1>x</h1>"}</function>'
    const { cleanText, toolUses } = recoverNativeToolCalls(text)
    expect(cleanText).toBe('')
    expect(toolUses).toHaveLength(1)
    expect(toolUses[0]?.name).toBe('Write')
    expect(toolUses[0]?.input).toEqual({
      file_path: 'a.html',
      content: '<h1>x</h1>',
    })
  })

  test('parses Qwen/Hermes <tool_call>{name,arguments}</tool_call>', () => {
    const text = '<tool_call>{"name":"shell","arguments":{"command":"ls -la"}}</tool_call>'
    const { toolUses } = recoverNativeToolCalls(text)
    expect(toolUses[0]?.name).toBe('Bash')
    expect(toolUses[0]?.input).toEqual({ command: 'ls -la' })
  })

  test('parses a whole-message bare {name,arguments} object', () => {
    const text = '{"name":"read_file","arguments":{"file_path":"x.ts"}}'
    const { toolUses } = recoverNativeToolCalls(text)
    expect(toolUses[0]?.name).toBe('Read')
    expect(toolUses[0]?.input).toEqual({ file_path: 'x.ts' })
  })

  test('leaves ordinary prose untouched', () => {
    const { toolUses } = recoverNativeToolCalls('Here is how the function works.')
    expect(toolUses).toHaveLength(0)
  })

  test('end-to-end: native function text becomes a tool_use with tool_use stop_reason', () => {
    const out = openAiCompletionToAnthropic(
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: '<function=Write>{"file_path":"i.html","content":"hi"}</function>',
            },
            finish_reason: 'stop',
          },
        ],
      },
      'nim-model',
    )
    expect(out.stop_reason).toBe('tool_use')
    const blocks = out.content as Array<{ type: string; name?: string }>
    expect(blocks.some(b => b.type === 'tool_use' && b.name === 'Write')).toBe(true)
  })
})

describe('openAiCompletionToBlink leaked syntax', () => {
  test('recovers Bash from python_tag text', () => {
    const out = openAiCompletionToAnthropic(
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: '<|python_tag|>touch index.html',
            },
            finish_reason: 'stop',
          },
        ],
      },
      'nim-model',
    )
    expect(out.stop_reason).toBe('tool_use')
    const blocks = out.content as Array<{ type: string; name?: string }>
    expect(blocks.some(b => b.type === 'tool_use' && b.name === 'Write')).toBe(
      true,
    )
  })

  test('recovers Write from key-value file_path= leak', () => {
    const out = openAiCompletionToAnthropic(
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'Write file_path=index.html content=\n<!DOCTYPE html><html><body>Hi</body></html>',
            },
            finish_reason: 'stop',
          },
        ],
      },
      'dracarys-llama',
    )
    expect(out.stop_reason).toBe('tool_use')
    const blocks = out.content as Array<{
      type: string
      name?: string
      input?: Record<string, unknown>
    }>
    const write = blocks.find(b => b.type === 'tool_use' && b.name === 'Write')
    expect(write?.input?.file_path).toBe('index.html')
  })
})

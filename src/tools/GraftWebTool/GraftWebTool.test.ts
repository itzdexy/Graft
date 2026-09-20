import { describe, expect, test } from 'bun:test'
import {
  buildWebActivityMetadata,
  isPlausibleWebUrl,
  runtimeClockForSearch,
  GraftWebTool,
} from './GraftWebTool.js'

describe('web activity metadata', () => {
  test('reports only the real query, count, and source hosts', () => {
    expect(
      buildWebActivityMetadata('search', 'NVIDIA NIM models', [
        { url: 'https://docs.nvidia.com/nim/one', title: 'One' },
        { url: 'https://build.nvidia.com/models', title: 'Two' },
        { url: 'https://docs.nvidia.com/nim/three', title: 'Three' },
      ]),
    ).toEqual({
      operation: 'search',
      query: 'NVIDIA NIM models',
      resultCount: 3,
      sourceHosts: ['docs.nvidia.com', 'build.nvidia.com'],
    })
  })

  test('does not copy snippets or page content into activity metadata', () => {
    const metadata = buildWebActivityMetadata('search', 'Graft', [
      {
        url: 'https://example.com',
        title: 'Example',
        snippet: 'private body-sized result text',
      },
    ])

    expect(JSON.stringify(metadata)).not.toContain('private body-sized')
  })
})

describe('runtimeClockForSearch', () => {
  test('grounds current time searches with the runtime clock', () => {
    const value = runtimeClockForSearch(
      'current time now',
      new Date('2026-07-30T03:00:00Z'),
    )
    expect(value).toContain('Runtime clock')
    expect(value).toContain('2026')
    expect(runtimeClockForSearch('time')).toContain('Runtime clock')
  })

  test('does not decorate unrelated searches', () => {
    expect(runtimeClockForSearch('typescript parser patterns')).toBeNull()
  })

  test('handles a weak model choosing read/time without fetching a fake URL', async () => {
    const result = await GraftWebTool.call(
      { action: 'read', target: 'time' },
      { abortController: new AbortController() } as never,
    )
    expect(result.data.output).toContain('Runtime clock')
  })
})

describe('isPlausibleWebUrl', () => {
  test('accepts hostnames and full URLs', () => {
    expect(isPlausibleWebUrl('example.com')).toBe(true)
    expect(isPlausibleWebUrl('https://example.com/path')).toBe(true)
    expect(isPlausibleWebUrl('localhost:3000')).toBe(true)
  })

  test('rejects phrases that would become nonsense https:// URLs', () => {
    expect(isPlausibleWebUrl('not a url')).toBe(false)
    expect(isPlausibleWebUrl('typescript parser patterns')).toBe(false)
    expect(isPlausibleWebUrl('time')).toBe(false)
  })

  test('read action rejects bare phrases instead of fetching https://phrase', async () => {
    const result = await GraftWebTool.call(
      { action: 'read', target: 'typescript parser patterns' },
      {
        abortController: new AbortController(),
        messages: [],
      } as never,
    )
    expect(result.data.output).toContain('not a usable URL')
  })
})

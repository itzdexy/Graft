import { describe, expect, test } from 'bun:test'
import { deriveFileNameFromPrompt } from './filenameFromPrompt.js'

describe('deriveFileNameFromPrompt', () => {
  test('explicit filename in prompt', () => {
    expect(deriveFileNameFromPrompt('create dashboard.html')).toBe('dashboard.html')
  })

  test('dashboard keyword', () => {
    expect(deriveFileNameFromPrompt('make me a dashboard')).toBe('dashboard.html')
  })

  test('generic html', () => {
    expect(deriveFileNameFromPrompt('code me a basic html page')).toBe('index.html')
  })

  test('docs site keyword', () => {
    expect(deriveFileNameFromPrompt('make me a full docs website')).toBe(
      'docs/index.html',
    )
  })
})

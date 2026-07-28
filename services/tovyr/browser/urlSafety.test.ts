import { describe, expect, test } from 'bun:test'
import {
  formatBlockedBrowserUrlMessage,
  validateBrowserFetchUrl,
} from './urlSafety.js'

describe('validateBrowserFetchUrl', () => {
  test('accepts http and https URLs', () => {
    expect(validateBrowserFetchUrl('https://example.com/docs')).toEqual({
      ok: true,
      url: 'https://example.com/docs',
    })
    expect(validateBrowserFetchUrl('http://localhost:3000/')).toEqual({
      ok: true,
      url: 'http://localhost:3000/',
    })
  })

  test('rejects javascript and file schemes', () => {
    expect(validateBrowserFetchUrl('javascript:alert(1)').ok).toBe(false)
    expect(validateBrowserFetchUrl('file:///etc/passwd').ok).toBe(false)
    expect(validateBrowserFetchUrl('data:text/html,hi').ok).toBe(false)
  })

  test('rejects empty and malformed URLs', () => {
    expect(validateBrowserFetchUrl('').ok).toBe(false)
    expect(validateBrowserFetchUrl('not a url').ok).toBe(false)
  })

  test('strips angle brackets from pasted URLs', () => {
    const result = validateBrowserFetchUrl('<https://docs.example.com/api>')
    expect(result).toEqual({
      ok: true,
      url: 'https://docs.example.com/api',
    })
  })

  test('formatBlockedBrowserUrlMessage includes reason', () => {
    const blocked = validateBrowserFetchUrl('javascript:void(0)')
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      const msg = formatBlockedBrowserUrlMessage(blocked)
      expect(msg).toContain('javascript')
      expect(msg).toContain('http(s)')
    }
  })
})
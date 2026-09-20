import { describe, expect, test } from 'bun:test'
import { browserReadPrompt, parseBrowserArgs } from './prompts.js'

describe('parseBrowserArgs', () => {
  test('empty or help returns help subcommand', () => {
    expect(parseBrowserArgs('')).toEqual({ sub: 'help', payload: '' })
    expect(parseBrowserArgs('help')).toEqual({ sub: 'help', payload: '' })
    expect(parseBrowserArgs('?')).toEqual({ sub: 'help', payload: '' })
  })

  test('research subcommand captures remainder as payload', () => {
    expect(parseBrowserArgs('research react hooks')).toEqual({
      sub: 'research',
      payload: 'react hooks',
    })
  })

  test('read subcommand captures URL or path remainder', () => {
    expect(parseBrowserArgs('read https://example.com/docs')).toEqual({
      sub: 'read',
      payload: 'https://example.com/docs',
    })
  })

  test('bare URL is treated as read', () => {
    expect(parseBrowserArgs('https://docs.example.com/api')).toEqual({
      sub: 'read',
      payload: 'https://docs.example.com/api',
    })
  })

  test('deep subcommand captures question', () => {
    expect(parseBrowserArgs('deep best vector databases')).toEqual({
      sub: 'deep',
      payload: 'best vector databases',
    })
  })

  test('unqualified text defaults to research', () => {
    expect(parseBrowserArgs('how does bun test work')).toEqual({
      sub: 'research',
      payload: 'how does bun test work',
    })
  })
})

describe('browserReadPrompt', () => {
  test('blocks javascript URLs before WebFetch', () => {
    const blocks = browserReadPrompt('javascript:alert(1)')
    const text = blocks[0]?.type === 'text' ? blocks[0].text : ''
    expect(text).toContain('Cannot fetch')
    expect(text).toContain('javascript')
  })

  test('includes normalized https URL for valid input', () => {
    const blocks = browserReadPrompt('<https://example.com/docs>')
    const text = blocks[0]?.type === 'text' ? blocks[0].text : ''
    expect(text).toContain('https://example.com/docs')
    expect(text).toContain('WebFetch')
  })
})
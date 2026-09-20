import { describe, expect, test } from 'bun:test'
import { isImplementationRequest } from './buildIntent.js'

describe('isImplementationRequest', () => {
  test('code me a html', () => {
    expect(isImplementationRequest('code me a html')).toBe(true)
  })

  test('make me a landing page', () => {
    expect(isImplementationRequest('make me a landing page')).toBe(true)
  })

  test('make a dashboard', () => {
    expect(isImplementationRequest('make a dashboard html page')).toBe(true)
  })

  test('build dashboard without me', () => {
    expect(isImplementationRequest('build dashboard.html')).toBe(true)
  })

  test('build a rust web server', () => {
    expect(isImplementationRequest('graft build a rust web server')).toBe(true)
  })

  test('docs site requests', () => {
    expect(isImplementationRequest('make me a full docs website')).toBe(true)
    expect(isImplementationRequest('build a documentation site')).toBe(true)
  })

  test('agent showcase page website', () => {
    expect(
      isImplementationRequest('code me a a agent showcase page website'),
    ).toBe(true)
  })

  test('explain this function', () => {
    expect(isImplementationRequest('explain this function')).toBe(false)
  })

  test('slash commands are ignored', () => {
    expect(isImplementationRequest('/code')).toBe(false)
  })
})

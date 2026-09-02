import { describe, expect, test } from 'bun:test'
import { detectTovyrPlatform, isTermux } from './tovyr-platform.js'

describe('Tovyr platform support', () => {
  test.each([
    ['win32', 'x64'],
    ['win32', 'arm64'],
    ['linux', 'x64'],
    ['linux', 'arm64'],
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
  ])('supports Bun executable target %s-%s', (platform, arch) => {
    const release = platform === 'darwin' ? '22.0.0' : '1.0.0'
    expect(detectTovyrPlatform({ platform, arch, release }).supported).toBe(true)
  })

  test('rejects 32-bit x86 with an actionable reason', () => {
    const result = detectTovyrPlatform({ platform: 'win32', arch: 'ia32' })
    expect(result.supported).toBe(false)
    expect(result.reason).toContain('32-bit x86')
  })

  test('detects Termux and requests its glibc bridge', () => {
    expect(isTermux({ TERMUX_VERSION: '0.118' })).toBe(true)
    const result = detectTovyrPlatform({
      platform: 'linux',
      arch: 'arm64',
      env: { PREFIX: '/data/data/com.termux/files/usr' },
    })
    expect(result.termux).toBe(true)
    expect(result.libc).toBe('termux-glibc')
  })

  test('rejects macOS releases older than 13', () => {
    expect(
      detectTovyrPlatform({
        platform: 'darwin',
        arch: 'x64',
        release: '21.6.0',
      }).supported,
    ).toBe(false)
  })
})

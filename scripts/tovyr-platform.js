import os from 'node:os'

const SUPPORTED = new Set([
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'win32-arm64',
  'win32-x64',
])

export function isTermux(env = process.env) {
  return Boolean(
    env.TERMUX_VERSION ||
      env.PREFIX?.includes('com.termux') ||
      env.ANDROID_ROOT,
  )
}

export function detectTovyrPlatform({
  platform = process.platform,
  arch = process.arch,
  env = process.env,
  release = os.release(),
} = {}) {
  const target = `${platform}-${arch}`
  const termux = platform === 'linux' && isTermux(env)
  let supported = SUPPORTED.has(target)
  let reason = ''

  if (arch === 'ia32') {
    supported = false
    reason = 'Bun does not publish a 32-bit x86 runtime'
  } else if (!supported) {
    reason = `no Bun executable target exists for ${target}`
  } else if (platform === 'darwin') {
    const major = Number.parseInt(String(release).split('.')[0] || '0', 10)
    if (Number.isFinite(major) && major > 0 && major < 22) {
      supported = false
      reason = 'Bun requires macOS 13 or newer'
    }
  }

  return {
    platform,
    arch,
    target,
    termux,
    supported,
    libc: termux ? 'termux-glibc' : platform === 'linux' ? 'auto' : 'native',
    reason,
  }
}

export function formatTovyrPlatform(info = detectTovyrPlatform()) {
  return `${info.target}${info.termux ? ' · Termux' : ''}`
}

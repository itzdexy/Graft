import { describe, expect, test } from 'bun:test'
import { matchSecretPath } from './secretPaths.js'

describe('secretPaths', () => {
  test('flags .env files', () => {
    expect(matchSecretPath('/project/.env')).toBeTruthy()
    expect(matchSecretPath('C:\\app\\.env.local')).toBeTruthy()
  })

  test('flags private keys', () => {
    expect(matchSecretPath('/home/user/.ssh/id_rsa')).toBeTruthy()
    expect(matchSecretPath('server.pem')).toBeTruthy()
  })

  test('allows normal source files', () => {
    expect(matchSecretPath('src/index.ts')).toBeNull()
    expect(matchSecretPath('README.md')).toBeNull()
  })
})

import { matchSecretPath } from './secretPaths.js'

/** Single directory-inspection commands; no substitutions, chaining, or redirection. */
export function isRoutineDirectoryInspection(command: string): boolean {
  const value = command.trim()
  if (!/^(?:ls|pwd|dir|Get-ChildItem|Get-Location)(?:\s|$)/i.test(value)) return false
  if (/[;&|<>`$%(){}\r\n\0]/.test(value)) return false
  const tokens = value.match(/"[^"]*"|'[^']*'|[^\s"']+/g) ?? []
  if (tokens.join('').replace(/\s/g, '') !== value.replace(/\s/g, '')) return false
  return tokens.slice(1).every(token => {
    const path = token.replace(/^["']|["']$/g, '')
    if (/^[\\/]{2}/.test(path) || (path.includes(':') && !/^[a-z]:[\\/][^:]*$/i.test(path))) return false
    return !matchSecretPath(path) && !/(?:^|[\\/])\.(?:ssh|aws|gnupg)(?:[\\/]|$)/i.test(path)
  })
}

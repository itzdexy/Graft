import { describe, expect, mock, test } from 'bun:test'

const calls: Array<{ file: string; args: string[]; cwd?: string }> = []

mock.module('../../../utils/execFileNoThrow.js', () => ({
  execFileNoThrowWithCwd: async (
    file: string,
    args: string[],
    opts: { cwd?: string },
  ) => {
    calls.push({ file, args, cwd: opts.cwd })
    return { code: 0, stdout: 'true', stderr: '' }
  },
}))

const { isGitRepo } = await import('./checkpoint.js')
const { gitExe } = await import('../../../utils/git.js')

describe('graft git checkpoint', () => {
  test('isGitRepo passes git executable and cwd separately', async () => {
    calls.length = 0
    await isGitRepo('/tmp/graft-checkpoint-test')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.file).toBe(gitExe())
    expect(calls[0]?.args).toEqual(['rev-parse', '--is-inside-work-tree'])
    expect(calls[0]?.cwd).toBe('/tmp/graft-checkpoint-test')
  })
})

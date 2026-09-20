import { afterEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileOpsTool } from './FileOpsTool.js'
import { moveToTrash, trashRoot } from './trash.js'

const created: string[] = []

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'graft-fileops-'))
  created.push(dir)
  return dir
}

afterEach(() => {
  while (created.length) {
    rmSync(created.pop()!, { recursive: true, force: true })
  }
})

/** The tool's call() takes a context it never touches for these operations. */
async function run(input: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (FileOpsTool.call as any)(input, {})) as {
    data: { trashedTo?: string; destination?: string; path: string }
  }
}

describe('FileOps', () => {
  test('mkdir creates missing parents', async () => {
    const dir = scratch()
    const target = join(dir, 'a', 'b', 'c')
    await run({ operation: 'mkdir', path: target })
    expect(existsSync(target)).toBe(true)
  })

  test('move relocates a file', async () => {
    const dir = scratch()
    const from = join(dir, 'from.txt')
    const to = join(dir, 'nested', 'to.txt')
    writeFileSync(from, 'contents')
    await run({ operation: 'move', path: from, destination: to })
    expect(existsSync(from)).toBe(false)
    expect(readFileSync(to, 'utf8')).toBe('contents')
  })

  test('copy duplicates a directory tree', async () => {
    const dir = scratch()
    mkdirSync(join(dir, 'src', 'deep'), { recursive: true })
    writeFileSync(join(dir, 'src', 'deep', 'f.txt'), 'x')
    await run({
      operation: 'copy',
      path: join(dir, 'src'),
      destination: join(dir, 'dst'),
    })
    expect(readFileSync(join(dir, 'dst', 'deep', 'f.txt'), 'utf8')).toBe('x')
    // Source survives.
    expect(existsSync(join(dir, 'src', 'deep', 'f.txt'))).toBe(true)
  })

  test('delete is recoverable rather than an unlink', async () => {
    const dir = scratch()
    const doomed = join(dir, 'doomed.txt')
    writeFileSync(doomed, 'still here')
    const { data } = await run({ operation: 'delete', path: doomed })

    expect(existsSync(doomed)).toBe(false)
    expect(data.trashedTo).toBeTruthy()
    // The whole point: the bytes are still on disk and can be moved back.
    expect(readFileSync(data.trashedTo!, 'utf8')).toBe('still here')
  })

  test('two deletes of the same filename do not overwrite each other', async () => {
    const dir = scratch()
    mkdirSync(join(dir, 'one'))
    mkdirSync(join(dir, 'two'))
    writeFileSync(join(dir, 'one', 'index.ts'), 'FIRST')
    writeFileSync(join(dir, 'two', 'index.ts'), 'SECOND')

    const a = moveToTrash(join(dir, 'one', 'index.ts'), 'collision-test')
    const b = moveToTrash(join(dir, 'two', 'index.ts'), 'collision-test')

    expect(a).not.toBe(b)
    expect(readFileSync(a, 'utf8')).toBe('FIRST')
    expect(readFileSync(b, 'utf8')).toBe('SECOND')
    rmSync(trashRoot('collision-test'), { recursive: true, force: true })
  })

  test('a deleted directory keeps its contents in the trash', async () => {
    // Exercises the copy-then-remove fallback in moveToTrash: renameSync
    // fails with EXDEV whenever the workspace and the Graft home sit on
    // different drives, which is the ordinary case on Windows.
    const dir = scratch()
    mkdirSync(join(dir, 'tree', 'nested'), { recursive: true })
    writeFileSync(join(dir, 'tree', 'nested', 'deep.txt'), 'survives')

    const landed = moveToTrash(join(dir, 'tree'), 'dir-delete-test')

    expect(existsSync(join(dir, 'tree'))).toBe(false)
    expect(readFileSync(join(landed, 'nested', 'deep.txt'), 'utf8')).toBe(
      'survives',
    )
    rmSync(trashRoot('dir-delete-test'), { recursive: true, force: true })
  })

  test('move refuses to clobber an existing destination', async () => {
    const dir = scratch()
    writeFileSync(join(dir, 'a.txt'), 'a')
    writeFileSync(join(dir, 'b.txt'), 'b')
    const verdict = await FileOpsTool.validateInput(
      {
        operation: 'move',
        path: join(dir, 'a.txt'),
        destination: join(dir, 'b.txt'),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    )
    expect(verdict.result).toBe(false)
    // b.txt is untouched.
    expect(readFileSync(join(dir, 'b.txt'), 'utf8')).toBe('b')
  })

  test('move and copy require a destination', async () => {
    const dir = scratch()
    writeFileSync(join(dir, 'a.txt'), 'a')
    for (const operation of ['move', 'copy']) {
      const verdict = await FileOpsTool.validateInput(
        { operation, path: join(dir, 'a.txt') },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
      )
      expect(verdict.result).toBe(false)
    }
  })

  test('operating on a missing path is refused', async () => {
    const verdict = await FileOpsTool.validateInput(
      { operation: 'delete', path: join(tmpdir(), 'graft-definitely-absent') },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    )
    expect(verdict.result).toBe(false)
  })

  test('the permission check keys on the path being written', () => {
    // move/copy write the destination; a rule allowing writes under the
    // destination must be what gets consulted, not one covering the source.
    expect(
      FileOpsTool.getPath({
        operation: 'move',
        path: '/a/from.txt',
        destination: '/b/to.txt',
      }),
    ).toBe('/b/to.txt')
    expect(
      FileOpsTool.getPath({ operation: 'delete', path: '/a/gone.txt' }),
    ).toBe('/a/gone.txt')
  })

  test('it is never treated as read-only', () => {
    expect(FileOpsTool.isReadOnly()).toBe(false)
    expect(FileOpsTool.isDestructive({ operation: 'delete', path: '/x' })).toBe(
      true,
    )
    expect(FileOpsTool.isDestructive({ operation: 'mkdir', path: '/x' })).toBe(
      false,
    )
  })
})

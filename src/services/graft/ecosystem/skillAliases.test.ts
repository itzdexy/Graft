import { describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { listEcosystemSkillIds } from './skills.js'

/**
 * Bundled skills are resolved before COMMANDS() in loadAllCommands, so a
 * bundled skill (or alias) silently shadows a real slash command of the same
 * name. The ecosystem pack registered `opencode`, `aider`, `codex`, `goose`,
 * `crush`, `plandex` and `warp` as aliases, so `/opencode` reached a four-line
 * blurb instead of commands/graft/opencode.ts.
 */
describe('ecosystem skills', () => {
  const commandNames = new Set(
    readdirSync(join(import.meta.dir, '../../../commands/graft')).map(file =>
      file.replace(/\.(tsx?)$/, '').replace(/\.impl$/, ''),
    ),
  )

  test('the commands directory was actually found', () => {
    expect(commandNames.size).toBeGreaterThan(10)
    expect(commandNames.has('opencode')).toBe(true)
  })

  test('no blurb skills are registered at all', () => {
    // They cost skill-list context on every turn and produced no work; the
    // model invoked one and wrote its payload into the user's repository.
    expect(listEcosystemSkillIds()).toEqual([])
  })

  test('nothing the pack used to register can shadow a command', () => {
    for (const id of listEcosystemSkillIds()) {
      expect(commandNames.has(id)).toBe(false)
      expect(commandNames.has(id.replace('ecosystem-', ''))).toBe(false)
    }
  })
})

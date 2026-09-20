import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isExplanationRequest, latestUserRequest, learningCommand, learningPrompt, loadLearning, recordLesson } from './learning.js'

let directory: string
let previous: string | undefined
beforeEach(() => {
  previous = process.env.GRAFT_HOME
  directory = mkdtempSync(join(tmpdir(), 'graft-learning-'))
  process.env.GRAFT_HOME = directory
})
afterEach(() => {
  if (previous === undefined) delete process.env.GRAFT_HOME
  else process.env.GRAFT_HOME = previous
  rmSync(directory, { recursive: true, force: true })
})
test('project preferences are isolated, bounded, inspectable, and removable', () => {
  const project = join(directory, 'one')
  learningCommand(project, 'remember Prefer concise answers')
  learningCommand(project, 'remember Prefer concise answers')
  expect(loadLearning(project).preferences).toEqual(['Prefer concise answers'])
  expect(loadLearning(join(directory, 'two')).preferences).toEqual([])
  expect(learningPrompt(project)).toContain('current user instructions and permissions take priority')
  expect(learningCommand(project, 'remember api_key=example')).toContain('cannot be saved')
  expect(learningCommand(project, `remember ${'x'.repeat(241)}`)).toContain('240')
  learningCommand(project, 'forget 1')
  expect(learningPrompt(project)).toBe('')
})
test('automatic lessons contain only fixed categories and can be disabled or cleared', () => {
  recordLesson(directory, 'failure')
  expect(loadLearning(directory).observations.failure).toBe(1)
  const store = join(directory, '.graft', 'learning')
  const data = JSON.parse(readFileSync(join(store, readdirSync(store)[0]!), 'utf8'))
  expect(data).toEqual({ enabled: true, preferences: [], observations: { failure: 1 } })
  learningCommand(directory, 'off')
  recordLesson(directory, 'failure')
  expect(loadLearning(directory).observations.failure).toBe(1)
  expect(learningPrompt(directory)).toBe('')
  learningCommand(directory, 'on')
  expect(learningPrompt(directory)).toContain('Do not repeat')
  learningCommand(directory, 'clear')
  expect(learningPrompt(directory)).toBe('')
})
test('explanation guard respects explicit implementation requests', () => {
  expect(isExplanationRequest('what is this folder about? explain it')).toBe(true)
  expect(isExplanationRequest('explain this project and fix its bugs')).toBe(false)
  expect(isExplanationRequest('create a website')).toBe(false)
  expect(latestUserRequest([
    { type: 'user', message: { content: 'explain this folder' } },
    { type: 'user', isMeta: true, message: { content: 'context' } },
    { type: 'user', message: { content: [{ type: 'tool_result', content: 'write a file' }] } },
  ])).toBe('explain this folder')
})

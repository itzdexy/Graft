import { expect, test } from 'bun:test'
import { TovyrToolErrorMessage } from './TovyrToolErrorMessage.js'

test('renders a generic failure when tool result content is absent', () => {
  expect(() =>
    TovyrToolErrorMessage({ content: undefined, verbose: false }),
  ).not.toThrow()
})

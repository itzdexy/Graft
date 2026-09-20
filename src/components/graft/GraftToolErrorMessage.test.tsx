import { expect, test } from 'bun:test'
import { GraftToolErrorMessage } from './GraftToolErrorMessage.js'

test('renders a generic failure when tool result content is absent', () => {
  expect(() =>
    GraftToolErrorMessage({ content: undefined, verbose: false }),
  ).not.toThrow()
})

import { expect, test } from 'bun:test'
import pkg from '../package.json'

test('Tovyr exposes focused quality gates', () => {
  expect(pkg.scripts['typecheck:tovyr']).toBe('tsc -p tsconfig.tovyr.json')
  expect(pkg.scripts['check:tovyr']).toBe('node scripts/tovyr-quality-gates.js')
})

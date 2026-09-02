import { describe, expect, test } from 'bun:test'
import {
  githubReadmeFastUrl,
  selectTovyrWebContent,
} from './contentSelection.js'

describe('Tovyr web content selection', () => {
  test('selects the URL anchor section', () => {
    const markdown = [
      '# Project',
      'Intro',
      '## Installation',
      '```bash',
      '# macOS',
      'bun install',
      '```',
      '### Windows',
      'Use PowerShell',
      '## Usage',
      'bun run',
    ].join('\n')
    expect(
      selectTovyrWebContent(markdown, 'https://example.com#installation'),
    ).toBe(
      '## Installation\n```bash\n# macOS\nbun install\n```\n### Windows\nUse PowerShell',
    )
  })

  test('clips oversized results', () => {
    expect(selectTovyrWebContent('x'.repeat(100), 'https://example.com', 20))
      .toContain('[Result clipped by Tovyr]')
  })

  test('maps GitHub repository roots to raw README', () => {
    expect(
      githubReadmeFastUrl('https://github.com/1jehuang/jcode#installation'),
    ).toBe(
      'https://raw.githubusercontent.com/1jehuang/jcode/HEAD/README.md',
    )
    expect(
      githubReadmeFastUrl('https://github.com/1jehuang/jcode/issues'),
    ).toBeNull()
  })
})

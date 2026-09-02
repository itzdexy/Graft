import { describe, expect, test } from 'bun:test'
import {
  deriveContentFromFailedEdit,
  extractEditErrorText,
  summarizeEditToolError,
} from './editRecovery.js'

describe('editRecovery', () => {
  test('extractEditErrorText reads tool_use_error tag', () => {
    expect(
      extractEditErrorText(
        '<tool_use_error>File does not exist. Note: your current working directory is /tmp.</tool_use_error>',
      ),
    ).toBe('File does not exist. Note: your current working directory is /tmp.')
  })

  test('summarizeEditToolError maps common failures', () => {
    expect(
      summarizeEditToolError('File has not been read yet. Read it first before writing to it.'),
    ).toBe('Read the file first')
    expect(
      summarizeEditToolError('File does not exist. Note: your current working directory is /tmp.'),
    ).toBe('File missing — use Write for new files')
    expect(
      summarizeEditToolError('String to replace not found in file.\nString: foo'),
    ).toBe('Text not found in file')
    expect(
      summarizeEditToolError('AIDER_SEARCH_MISS: One or more SEARCH blocks did not match the file.'),
    ).toBe('Search block did not match')
    expect(
      summarizeEditToolError(
        'TypeError: Second argument must be either a string or a regular expression',
      ),
    ).toBe('Invalid edit arguments — use strings for old_string and new_string')
    expect(
      summarizeEditToolError(
        'Error calling tool (Edit): Second argument must be either an array of arguments or an options object: C:\\Program Files\\Git\\cmd\\git.exe',
      ),
    ).toBe('Git checkpoint failed — edit not blocked')
  })

  test('deriveContentFromFailedEdit uses new_string for new-file Edit', () => {
    const derived = deriveContentFromFailedEdit(
      {
        file_path: 'index.html',
        old_string: '',
        new_string: '<!DOCTYPE html><html><body>hi</body></html>',
      },
      '/tmp/project',
    )
    expect(derived).toEqual({
      filePath: 'index.html',
      content: '<!DOCTYPE html><html><body>hi</body></html>',
    })
  })

  test('deriveContentFromFailedEdit writes full html when file missing', () => {
    const derived = deriveContentFromFailedEdit(
      {
        file_path: 'index.html',
        old_string: 'placeholder',
        new_string: '<!DOCTYPE html><html><body>benchmark</body></html>',
      },
      '/tmp/project',
    )
    expect(derived?.content).toContain('benchmark')
  })

  test('deriveContentFromFailedEdit parses aider blocks for new files', () => {
    const derived = deriveContentFromFailedEdit(
      {
        file_path: 'README.md',
        old_string: '',
        new_string: `<<<<<<< SEARCH
=======
# Benchmark
>>>>>>> REPLACE`,
      },
      '/tmp/project',
    )
    expect(derived?.content).toContain('# Benchmark')
  })
})

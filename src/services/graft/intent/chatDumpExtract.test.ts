import { describe, expect, test } from 'bun:test'
import {
  extractChatFileDump,
  isChatFileDumpText,
  isModelWriteFailureMessage,
} from './chatDumpExtract.js'

describe('chatDumpExtract', () => {
  test('extracts Filename/Content block', () => {
    const text = `I will create a landing page.

Filename: landing_page.html
Content:

<!DOCTYPE html>
<html><body>Hi</body></html>`
    const dump = extractChatFileDump(text)
    expect(dump?.filePath).toBe('landing_page.html')
    expect(dump?.content).toContain('<!DOCTYPE html>')
  })

  test('extracts fenced html', () => {
    const text = `Here is the file:

\`\`\`html
<!DOCTYPE html>
<html><head></head><body></body></html>
\`\`\``
    expect(isChatFileDumpText(text)).toBe(true)
    expect(extractChatFileDump(text)?.filePath).toBe('index.html')
  })

  test('extracts raw doctype block', () => {
    const text = `landing_page.html

<!DOCTYPE html>
<html lang="en"><head></head><body></body></html>`
    const dump = extractChatFileDump(text)
    expect(dump?.filePath).toBe('landing_page.html')
  })

  test('extracts key-value Write leak', () => {
    const dump = extractChatFileDump(
      'Write file_path=D:\\proj\\index.html content=\n<!DOCTYPE html><html></html>',
    )
    expect(dump?.filePath).toBe('index.html')
    expect(dump?.content).toContain('<!DOCTYPE html>')
  })

  test('extracts comma-separated key-value leak', () => {
    const dump = extractChatFileDump(
      'Write file_path=D:\\proj\\index.html, content=\\n \\n Basic HTML Page',
    )
    expect(dump?.filePath).toBe('index.html')
    expect(dump?.content).toContain('Basic HTML Page')
  })

  test('extracts fenced html with manual save instructions', () => {
    const text = `Here is your dashboard:

\`\`\`html
<!DOCTYPE html>
<html><head><title>Dashboard</title></head><body><h1>Dashboard</h1></body></html>
\`\`\`

1. Open Notepad
2. Click Save As
3. Navigate to your folder
4. Save as dashboard.html`
    const dump = extractChatFileDump(text, 'make me a dashboard html')
    expect(dump?.filePath).toBe('dashboard.html')
    expect(dump?.content).toContain('<!DOCTYPE html>')
  })

  test('uses user prompt filename when assistant omits it', () => {
    const text = `Here's the page:

\`\`\`html
<!DOCTYPE html>
<html><head></head><body><p>Hi</p></body></html>
\`\`\``
    const dump = extractChatFileDump(text, 'create dashboard.html for my project')
    expect(dump?.filePath).toBe('dashboard.html')
  })

  test('isModelWriteFailureMessage detects not available phrasing', () => {
    expect(
      isModelWriteFailureMessage(
        'It seems that the Write tool is not available.',
      ),
    ).toBe(true)
    expect(
      isModelWriteFailureMessage('I cannot use the Write tool in this mode.'),
    ).toBe(true)
  })
})

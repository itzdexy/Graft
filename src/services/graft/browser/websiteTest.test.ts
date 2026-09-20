import { expect, test } from 'bun:test'
import { websiteTestSchema, validateWebsiteTestUrl } from './websiteTest.js'

test('allows the requested localhost origin but blocks unrelated private targets', () => {
  expect(validateWebsiteTestUrl('http://localhost:5173').origin).toBe('http://localhost:5173')
  expect(() => validateWebsiteTestUrl('http://localhost:8080', 'http://localhost:5173')).toThrow()
  for (const url of ['file:///etc/passwd', 'https://user:pass@example.com', 'http://169.254.169.254', 'http://192.168.0.1', 'http://[::ffff:127.0.0.1]']) {
    expect(() => validateWebsiteTestUrl(url)).toThrow()
  }
  expect(validateWebsiteTestUrl('https://fdocs.example').hostname).toBe('fdocs.example')
})

test('bounds actions and rejects arbitrary JavaScript and local file uploads', () => {
  expect(websiteTestSchema.parse({ url: 'http://localhost:5173' }).viewport).toBe('desktop')
  for (const action of ['evaluate', 'upload', 'shell']) {
    expect(websiteTestSchema.safeParse({ url: 'https://example.com', steps: [{ action }] }).success).toBe(false)
  }
  expect(websiteTestSchema.safeParse({ url: 'https://example.com', steps: Array(21).fill({ action: 'expect_text', text: 'hello' }) }).success).toBe(false)
})

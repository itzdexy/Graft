import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildAgentShowcasePageHtml,
  buildStarterLandingPageHtml,
  buildRustCargoToml,
  tryImplementationFilesystemFallback,
  isBlinkGenericStarterMarkup,
  extractTopicFromPrompt,
} from './implementationFallback.js'

describe('implementationFallback', () => {
  test('buildStarterLandingPageHtml includes title', () => {
    const html = buildStarterLandingPageHtml('make me a landing page for Acme')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Acme')
    expect(html).not.toContain('starter landing page scaffold')
  })

  test('buildStarterLandingPageHtml is topic-specific for model pages', () => {
    const html = buildStarterLandingPageHtml('code me a html about ornith-1.0-35b')
    expect(html).toContain('Ornith-1.0-35B')
    expect(html).toContain('ornith-1.0-35b')
    expect(html).toContain('Hugging Face')
    expect(html).not.toContain('Created by Blink')
    expect(html).not.toContain('Generated for:')
    expect(html).not.toContain('Fast</h2><p>Ship a clean single-page layout')
    expect(extractTopicFromPrompt('code me a html about ornith-1.0-35b')).toBe(
      'ornith-1.0-35b',
    )
    expect(
      extractTopicFromPrompt(
        'code me a website for an ai model benchmark of ornith-1.0-35b',
      ),
    ).toBe('ornith-1.0-35b')
  })

  test('buildAgentShowcasePageHtml for showcase requests', () => {
    const html = buildAgentShowcasePageHtml(
      'code me a agent showcase page website',
    )
    expect(html).toContain('Agent Showcase')
    expect(html).toContain('Featured agents')
    expect(html).toContain('Planner')
  })

  test('isBlinkGenericStarterMarkup detects legacy generic scaffold', () => {
    const legacy =
      '<span>Created by Blink</span><p>starter landing page scaffold</p>'
    expect(isBlinkGenericStarterMarkup(legacy)).toBe(true)
    expect(isBlinkGenericStarterMarkup(buildAgentShowcasePageHtml('showcase'))).toBe(
      false,
    )
    expect(
      isBlinkGenericStarterMarkup(
        buildStarterLandingPageHtml('make me a html about cats'),
      ),
    ).toBe(false)
  })

  test('tryImplementationFilesystemFallback does not auto-write html pages', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'blink-topic-upgrade-'))
    try {
      const path = join(dir, 'index.html')
      await writeFile(
        path,
        '<html><body>Created by Blink starter landing page scaffold</body></html>',
        'utf8',
      )
      const result = await tryImplementationFilesystemFallback(
        'code me a html about ornith-1.0-35b',
        dir,
      )
      expect(result.wrote).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('tryImplementationFilesystemFallback does not write showcase html', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'blink-showcase-'))
    try {
      const result = await tryImplementationFilesystemFallback(
        'code me a agent showcase page website',
        dir,
      )
      expect(result.wrote).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('tryImplementationFilesystemFallback skips generic html requests', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'blink-fallback-'))
    try {
      const result = await tryImplementationFilesystemFallback(
        'make me a html',
        dir,
      )
      expect(result.wrote).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('tryImplementationFilesystemFallback skips dashboard html requests', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'blink-fallback-'))
    try {
      const result = await tryImplementationFilesystemFallback(
        'code me a SaaS dashboard',
        dir,
      )
      expect(result.wrote).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('tryImplementationFilesystemFallback writes rust web server scaffold', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'blink-rust-'))
    try {
      const result = await tryImplementationFilesystemFallback(
        'build a rust web server',
        dir,
      )
      expect(result.wrote).toBe(true)
      if (result.wrote) {
        expect(result.path).toContain('main.rs')
        const cargo = await readFile(join(dir, 'Cargo.toml'), 'utf8')
        expect(cargo).toContain('axum')
        const main = await readFile(join(dir, 'src', 'main.rs'), 'utf8')
        expect(main).toContain('axum::serve')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('tryImplementationFilesystemFallback writes docs site', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'blink-docs-'))
    try {
      const result = await tryImplementationFilesystemFallback(
        'make me a full docs website for blink',
        dir,
      )
      expect(result.wrote).toBe(true)
      if (result.wrote) {
        expect(result.path).toContain('docs')
        const content = await readFile(result.path, 'utf8')
        expect(content).toContain('Blink Documentation')
        expect(content).toContain('Getting started')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('buildRustCargoToml uses slug name', () => {
    expect(buildRustCargoToml('my_app')).toContain('name = "my_app"')
  })

  test('rust starter completes project when empty main.rs exists at root', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'blink-rust-partial-'))
    try {
      await writeFile(join(dir, 'main.rs'), '', 'utf8')
      const result = await tryImplementationFilesystemFallback(
        'build a rust web server',
        dir,
      )
      expect(result.wrote).toBe(true)
      if (result.wrote) {
        expect(result.path.replace(/\\/g, '/')).toContain('src/main.rs')
        const cargo = await readFile(join(dir, 'Cargo.toml'), 'utf8')
        expect(cargo).toContain('axum')
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('skips when index.html already exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'blink-fallback-'))
    try {
      const path = join(dir, 'index.html')
      await Bun.write(path, '<!DOCTYPE html><html><body>existing</body></html>')
      const result = await tryImplementationFilesystemFallback(
        'make me a html',
        dir,
      )
      expect(result.wrote).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

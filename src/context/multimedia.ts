/**
 * Image and web page context (Aider / Gemini @file pattern).
 */

import { readFileSync, existsSync } from 'node:fs'
import { extname } from 'node:path'

export interface WebPageContext {
  url: string
  title?: string
  excerpt: string
  fetchedAt: number
}

export interface ImageContext {
  path: string
  mimeType: string
  width?: number
  height?: number
  alt?: string
}

const IMAGE_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export function isImagePath(filePath: string): boolean {
  return extname(filePath).toLowerCase() in IMAGE_EXT
}

export function loadImageContext(filePath: string): ImageContext | null {
  if (!existsSync(filePath) || !isImagePath(filePath)) return null
  const ext = extname(filePath).toLowerCase()
  return {
    path: filePath,
    mimeType: IMAGE_EXT[ext] ?? 'application/octet-stream',
  }
}

export function formatImageContextHint(ctx: ImageContext): string {
  return [
    '# Image context',
    `Path: ${ctx.path}`,
    `Type: ${ctx.mimeType}`,
    'Use the Read tool or pasted image blocks for pixel data.',
  ].join('\n')
}

/** Strip HTML to plain text excerpt for prompt injection. */
export function htmlToExcerpt(html: string, maxChars = 8000): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}

export function createWebPageContext(
  url: string,
  htmlOrText: string,
  title?: string,
): WebPageContext {
  return {
    url,
    title,
    excerpt: htmlToExcerpt(htmlOrText),
    fetchedAt: Date.now(),
  }
}

export function formatWebPageContext(ctx: WebPageContext): string {
  const parts = [
    '# Web page context',
    `URL: ${ctx.url}`,
    ctx.title ? `Title: ${ctx.title}` : '',
    '',
    ctx.excerpt,
  ].filter(Boolean)
  return parts.join('\n')
}

/** Load local HTML file as web context. */
export function loadLocalHtmlContext(filePath: string): WebPageContext | null {
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath, 'utf8')
    const title = raw.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
    return createWebPageContext(`file://${filePath}`, raw, title)
  } catch {
    return null
  }
}

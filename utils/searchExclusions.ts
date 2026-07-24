import { resolve } from 'path'

const DEFAULT_EXCLUDED_DIRECTORY_NAMES = [
  '.git',
  '.svn',
  '.hg',
  '.bzr',
  '.jj',
  '.sl',
  '.claude',
  '.blink',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
] as const

export const DEFAULT_SEARCH_EXCLUSION_GLOBS = [
  ...DEFAULT_EXCLUDED_DIRECTORY_NAMES.map(dir => `!**/${dir}/**`),
] as const

export function shouldApplyDefaultSearchExclusions(searchDir: string): boolean {
  const parts = resolve(searchDir).split(/[\\/]+/)
  return !DEFAULT_EXCLUDED_DIRECTORY_NAMES.some(dir => parts.includes(dir))
}

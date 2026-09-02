/**
 * Locate an installed Chromium-family browser to drive over CDP.
 *
 * Tovyr shipped a Playwright adapter that nothing ever constructed, and
 * `playwright` is not a dependency — so the only working browser path was
 * `BROWSER_USE_API_KEY`, a paid cloud service. Driving a browser the user
 * already has, over the DevTools Protocol, needs no new dependency at all:
 * `ws` is already installed and every Chromium build speaks CDP.
 *
 * Edge ships with Windows, so this practically always resolves there.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type ChromiumCandidate = {
  /** Absolute path to the executable. */
  path: string
  /** Human name for messages. */
  name: string
}

/**
 * Candidate executables, most-preferred first.
 *
 * Chrome and Brave lead because a user who installed one is more likely to
 * expect automation there; Edge is last but is the reliable fallback since it
 * is present on stock Windows.
 */
export function chromiumCandidates(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): ChromiumCandidate[] {
  if (platform === 'win32') {
    const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
    const programFilesX86 =
      env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
    const localAppData =
      env.LOCALAPPDATA ?? join(env.USERPROFILE ?? 'C:\\', 'AppData', 'Local')

    return [
      {
        name: 'Chrome',
        path: join(programFiles, 'Google/Chrome/Application/chrome.exe'),
      },
      {
        name: 'Chrome',
        path: join(programFilesX86, 'Google/Chrome/Application/chrome.exe'),
      },
      {
        name: 'Chrome',
        path: join(localAppData, 'Google/Chrome/Application/chrome.exe'),
      },
      {
        name: 'Brave',
        path: join(
          programFiles,
          'BraveSoftware/Brave-Browser/Application/brave.exe',
        ),
      },
      {
        name: 'Edge',
        path: join(programFilesX86, 'Microsoft/Edge/Application/msedge.exe'),
      },
      {
        name: 'Edge',
        path: join(programFiles, 'Microsoft/Edge/Application/msedge.exe'),
      },
    ]
  }

  if (platform === 'darwin') {
    return [
      {
        name: 'Chrome',
        path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      },
      {
        name: 'Brave',
        path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      },
      {
        name: 'Edge',
        path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      },
      {
        name: 'Chromium',
        path: '/Applications/Chromium.app/Contents/MacOS/Chromium',
      },
    ]
  }

  return [
    { name: 'Chrome', path: '/usr/bin/google-chrome' },
    { name: 'Chrome', path: '/usr/bin/google-chrome-stable' },
    { name: 'Chromium', path: '/usr/bin/chromium' },
    { name: 'Chromium', path: '/usr/bin/chromium-browser' },
    { name: 'Brave', path: '/usr/bin/brave-browser' },
    { name: 'Edge', path: '/usr/bin/microsoft-edge' },
  ]
}

/**
 * First candidate that exists on disk.
 *
 * `TOVYR_BROWSER_PATH` overrides everything — a user with a portable build or
 * an unusual install location should not have to patch this list.
 */
export function findChromium(
  exists: (path: string) => boolean = existsSync,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): ChromiumCandidate | null {
  const override = env.TOVYR_BROWSER_PATH?.trim()
  if (override) {
    // Trusted as given: if the user pointed at something missing, that is a
    // configuration error worth surfacing rather than silently falling back to
    // a different browser than the one they asked for.
    return { name: 'configured browser', path: override }
  }

  for (const candidate of chromiumCandidates(env, platform)) {
    if (exists(candidate.path)) return candidate
  }
  return null
}

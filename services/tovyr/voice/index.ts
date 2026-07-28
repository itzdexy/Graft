/**
 * Voice & computer-use stubs (Phase 13).
 */

export function isVoiceEnabled(): boolean {
  return process.env.TOVYR_VOICE === '1'
}

export function formatVoiceStatus(): string {
  if (!isVoiceEnabled()) {
    return [
      'Voice: off. Set TOVYR_VOICE=1 for future wake-word / push-to-talk.',
      'Computer use: gated via subscription when configured.',
    ].join(' ')
  }
  return 'Voice: enabled (stub). Push-to-talk UI planned; use typed prompts for now.'
}

export function formatComputerUseGuidance(): string {
  return [
    '# Computer / voice (Phase 13)',
    '',
    '- **Voice**: TOVYR_VOICE=1 — STT/TTS pipeline planned',
    '- **Computer use**: WebBrowser / BrowserUse tools + permission tiers; confirm destructive input',
    '- **Sandbox**: all mouse/keyboard actions require user approval unless /bypass',
  ].join('\n')
}

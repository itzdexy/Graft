/** Rotating tips shown across startup loader, /tips, and /buddy tip. */
export const BLINK_TIPS = [
  'Try /dash for a quick project overview.',
  'Use /commands to fuzzy-search every slash command.',
  'Switch providers with /provider and models with /model.',
  'Run /theme to change colors and contrast.',
  'Type /plan before big changes to create blinkplan.md.',
  'Use /review after edits for a focused code review.',
  'Run /status to see your current model, cost, and context.',
  'Resume past work with /resume or /continue.',
  'Set personal preferences in /config.',
  'Press ? or type /help to discover commands.',
  'Run /tips anytime to see a random tip.',
  'Type /welcome if you are new or want a quick tour.',
  'Tell /buddy remember <fact> to capture project decisions.',
  'Set /buddy goals <goal> so Blink can track what you are working toward.',
  'Use /oops after an error to see common recovery steps.',
]

export function randomBlinkTip() {
  return BLINK_TIPS[Math.floor(Math.random() * BLINK_TIPS.length)]
}

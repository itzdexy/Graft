/**
 * Lightweight model capability badges for Node CLI scripts.
 * Full metadata lives in services/blink/modelCapabilities.ts (Bun runtime).
 */

/** @param {string} modelId */
export function inferCapabilityBadges(modelId) {
  const id = modelId.toLowerCase()
  const badges = []
  if (!/\b(embed|embedding|whisper|tts|dall-e|imagen)\b/.test(id)) {
    badges.push('tools')
  }
  if (/\b(vision|vl|4o|gemini|pixtral|llava|qwen-vl)\b/.test(id)) {
    badges.push('vision')
  }
  if (/\b(o1|o3|r1|reason|think|deepseek-r1|qwq|opus)\b/.test(id) && !/\bmini\b/.test(id)) {
    badges.push('reasoning')
  }
  if (/\b(haiku|mini|flash|8b|7b|3b|nano|lite)\b/.test(id)) {
    badges.push('budget')
  } else if (/\b(opus|o1|o3|pro|gpt-4|sonnet-4)\b/.test(id)) {
    badges.push('premium')
  } else {
    badges.push('standard')
  }
  return badges
}

/** @param {string} modelId */
export function formatModelCapabilityLine(modelId) {
  return inferCapabilityBadges(modelId).join(' · ')
}

/**
 * Past tense verb for turn completion messages, used as "<verb> for 5s".
 *
 * This was a rotating list of kitchen metaphors — "Baked for 5m 28s",
 * "Sautéed for 59s" — sampled at random per turn. Whimsy in a status line
 * costs the reader twice: the word carries no information, and because it
 * changes every turn it draws the eye to the one part of the row that never
 * means anything. A single plain verb lets the duration be the content.
 *
 * Kept as an array because the call sites sample from it; a one-element list
 * makes every one of them deterministic without touching them.
 */
export const TURN_COMPLETION_VERBS = ['Worked']

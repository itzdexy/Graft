/**
 * Which distribution this build is.
 *
 * Upstream this was `process.env.USER_TYPE`, substituted at build time so the
 * bundler could delete Anthropic-internal branches. The substitution ran over
 * the source in this fork, leaving 122 comparisons of the literal form
 * `if ("external" === 'ant')`. Those are not just dead -- they are ill-typed,
 * and TypeScript reports every one of them, which buried the resolution
 * failures that were real bugs.
 *
 * Naming the constant restores the intent and makes the branches greppable.
 * The annotation is deliberately the full union: without it TypeScript narrows
 * to `'external'` and the comparisons become errors again.
 */
export type UserType = 'external' | 'ant'

export const USER_TYPE: UserType = 'external'

/** True in Anthropic-internal builds. Always false in this distribution. */
export function isAntUser(): boolean {
  return USER_TYPE === 'ant'
}

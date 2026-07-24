// Content for the verify bundled skill (ant-only; lazy-loaded so external builds skip missing assets).

/* eslint-disable @typescript-eslint/no-require-imports */
export const SKILL_MD: string =
  process.env.USER_TYPE === 'ant'
    ? (require('./verify/SKILL.md') as { default: string }).default
    : ''

export const SKILL_FILES: Record<string, string> =
  process.env.USER_TYPE === 'ant'
    ? {
        'examples/cli.md': (
          require('./verify/examples/cli.md') as { default: string }
        ).default,
        'examples/server.md': (
          require('./verify/examples/server.md') as { default: string }
        ).default,
      }
    : {}
/* eslint-enable @typescript-eslint/no-require-imports */

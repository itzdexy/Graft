# Contributing

Use Node.js 22+ and Bun. Install with `bun install --frozen-lockfile --ignore-scripts`.

Before submitting changes, run:

```sh
bun test src scripts
bun run build:runtime
node bin/graft.js --version
```

For browser changes, also run `bun scripts/graft-browser-smoke.ts` with Chrome, Edge, or Chromium installed. Exercise both successful and failing checks with local, credential-free fixtures.

The imported application's broad typecheck has existing failures. Do not present it as passing or hide new diagnostics.

Do not include settings, credentials, browser profiles, captures, session history, private notes, build caches, or recordings in pull requests. Preserve model/provider identifiers and third-party legal notices when changing product branding.

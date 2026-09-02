# Tovyr Module Contract

## Public API surface

These modules are the only cross-layer API surface. New code should import through these files, not deep into submodules.

| Layer | Public entry | Purpose |
|-------|--------------|---------|
| Constants | `constants/tovyr.js` | Brand, version, command name, env var names, file names, repo URL |
| Core env | `utils/envUtils.js` | `isEnvTruthy`, safe env readers |
| Core config | `utils/config.js` | `getGlobalConfig`, `saveGlobalConfig`, project config |
| Core fs | `utils/slowOperations.js` | `writeFileSync_DEPRECATED`, atomic writes |
| Core logging | `services/analytics/index.js` | `logEvent`, `logError` |
| Core errors | `utils/errors.js` | `getErrnoCode`, error classification |
| Theme | `components/design-system/themeTokens.ts` | `getDesignTokens`, color/spacing tokens |
| Model | `services/tovyr/providerModelPick.ts` | `pickBestProviderModel`, `reconcileModelWithVerified` |
| Providers | `scripts/tovyr-providers.js` | `getProvider`, `resolveActive`, `loadState` |
| Tools | `tools.js` | `getTools`, `findToolByName` |
| MCP | `services/mcp/MCPConnectionManager.js` | `MCPConnectionManager` |
| Browser | `services/tovyr/browser/playwright.ts` | `buildPlaywrightMcpConfig`, `getPlaywrightMcpStatus` |
| Agent | `tools/AgentTool/AgentTool.ts` | `AgentTool`, `loadAgentsDir` |
| Memory | `services/tovyr/memory/` | Buddy memory, project memory, knowledge graph |

## Forbidden patterns

1. **No direct `process.env` reads outside `utils/envUtils.js` and `constants/`** — use `isEnvTruthy` or typed helpers.
2. **No `fs` reads outside `utils/` and `tools/`** — use `safe` readers and checkpointed writes.
3. **No React/JSX in `services/` or `scripts/`** — keep those layers framework-agnostic.
4. **No CLI parsing in `components/` or `services/`** — pass options as typed props/state.
5. **No direct `fetch` outside `services/api/` and `utils/`** — all network calls go through instrumented clients.
6. **No hard-coded colors outside `components/design-system/themeTokens.ts`** — use tokens.

## Import rules

Use deep imports for the same layer, public entry for cross-layer.

Good:
```ts
import { getGlobalConfig } from '../../utils/config.js'
import { pickBestProviderModel } from '../../services/tovyr/providerModelPick.js'
```

Avoid:
```ts
import { _internalHelper } from '../../services/tovyr/providerModelPick.js'
import { someComponent } from '../../components/LogoV2/LogoV2.tsx'
```

## Cycles

Run `npx madge --circular src/main.tsx` to detect cycles. The target is zero cycles except for the unavoidable `AppState` → `onChangeAppState` → `services/telemetry` → `AppState` closure. Break that by making telemetry subscribe through a side-channel interface.

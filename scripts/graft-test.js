#!/usr/bin/env node
/**
 * Run Graft unit tests with Bun, resolving the executable on Windows when
 * bun is not on PATH (same discovery as graft-warm.js / bin/graft.js).
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  assertBunAvailable,
  getGraftPackageRoot,
} from './graft-package-root.js'

const root = getGraftPackageRoot()
const bun = assertBunAvailable()

const defaultArgs = [
  'test',
  'src/services/graft',
  'src/bridge/debugUtils.test.ts',
  'scripts/graft-cli-ux.test.js',
  'scripts/graft-workflow-prompts.test.js',
  'scripts/graft-cli.integration.test.ts',
  'scripts/graft-bench.integration.test.ts',
  'src/services/graft/benchmark/scoring.test.ts',
  'scripts/graft-provider-cli.test.ts',
  'scripts/graft-provider-local.test.ts',
  'src/services/graft/modelCapabilities.test.ts',
  'src/services/graft/providerErrors.test.ts',
  'src/services/graft/agent/loopGuard.test.ts',
  'src/services/graft/context/gitDiffContext.test.ts',
  'src/services/graft/validateProviderConfig.test.ts',
  'src/services/graft/invocationCwdContract.test.ts',
  'src/components/graft/GraftLiveActivity.test.tsx',
  'src/utils/filePersistence/types.test.ts',
  'src/utils/graftStartupLoader.test.ts',
  'src/utils/earlyInput.test.ts',
  'src/ink/events/input-event.test.ts',
  'src/constants/graftSystemPrompt.test.ts',
]

const extra = process.argv.slice(2)
const args = extra.length > 0 ? ['test', ...extra] : defaultArgs

const result = spawnSync(bun, args, {
  cwd: root,
  stdio: 'inherit',
  shell: false,
})

process.exit(result.status ?? 1)

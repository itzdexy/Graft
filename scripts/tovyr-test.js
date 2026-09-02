#!/usr/bin/env node
/**
 * Run Tovyr unit tests with Bun, resolving the executable on Windows when
 * bun is not on PATH (same discovery as tovyr-warm.js / bin/tovyr.js).
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  assertBunAvailable,
  getTovyrPackageRoot,
} from './tovyr-package-root.js'

const root = getTovyrPackageRoot()
const bun = assertBunAvailable()

const defaultArgs = [
  'test',
  'src/services/tovyr',
  'src/bridge/debugUtils.test.ts',
  'scripts/tovyr-cli-ux.test.js',
  'scripts/tovyr-workflow-prompts.test.js',
  'scripts/tovyr-cli.integration.test.ts',
  'scripts/tovyr-bench.integration.test.ts',
  'src/services/tovyr/benchmark/scoring.test.ts',
  'scripts/tovyr-provider-cli.test.ts',
  'scripts/tovyr-provider-local.test.ts',
  'src/services/tovyr/modelCapabilities.test.ts',
  'src/services/tovyr/providerErrors.test.ts',
  'src/services/tovyr/agent/loopGuard.test.ts',
  'src/services/tovyr/context/gitDiffContext.test.ts',
  'src/services/tovyr/validateProviderConfig.test.ts',
  'src/services/tovyr/invocationCwdContract.test.ts',
  'src/components/tovyr/TovyrLiveActivity.test.tsx',
  'src/utils/filePersistence/types.test.ts',
  'src/utils/tovyrStartupLoader.test.ts',
  'src/utils/earlyInput.test.ts',
  'src/ink/events/input-event.test.ts',
  'src/constants/tovyrSystemPrompt.test.ts',
]

const extra = process.argv.slice(2)
const args = extra.length > 0 ? ['test', ...extra] : defaultArgs

const result = spawnSync(bun, args, {
  cwd: root,
  stdio: 'inherit',
  shell: false,
})

process.exit(result.status ?? 1)

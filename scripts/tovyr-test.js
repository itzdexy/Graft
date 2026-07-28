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
  'services/tovyr',
  'bridge/debugUtils.test.ts',
  'scripts/tovyr-cli-ux.test.js',
  'scripts/tovyr-workflow-prompts.test.js',
  'scripts/tovyr-cli.integration.test.ts',
  'scripts/tovyr-bench.integration.test.ts',
  'services/tovyr/benchmark/scoring.test.ts',
  'scripts/tovyr-provider-cli.test.ts',
  'scripts/tovyr-provider-local.test.ts',
  'services/tovyr/modelCapabilities.test.ts',
  'services/tovyr/providerErrors.test.ts',
  'services/tovyr/agent/loopGuard.test.ts',
  'services/tovyr/context/gitDiffContext.test.ts',
  'services/tovyr/validateProviderConfig.test.ts',
  'services/tovyr/invocationCwdContract.test.ts',
  'components/tovyr/TovyrLiveActivity.test.tsx',
  'utils/filePersistence/types.test.ts',
  'utils/tovyrStartupLoader.test.ts',
  'utils/earlyInput.test.ts',
  'ink/events/input-event.test.ts',
  'constants/tovyrSystemPrompt.test.ts',
]

const extra = process.argv.slice(2)
const args = extra.length > 0 ? ['test', ...extra] : defaultArgs

const result = spawnSync(bun, args, {
  cwd: root,
  stdio: 'inherit',
  shell: false,
})

process.exit(result.status ?? 1)

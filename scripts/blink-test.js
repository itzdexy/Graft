#!/usr/bin/env node
/**
 * Run Blink unit tests with Bun, resolving the executable on Windows when
 * bun is not on PATH (same discovery as blink-warm.js / bin/blink.js).
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  assertBunAvailable,
  getBlinkPackageRoot,
} from './blink-package-root.js'

const root = getBlinkPackageRoot()
const bun = assertBunAvailable()

const defaultArgs = [
  'test',
  'services/blink',
  'bridge/debugUtils.test.ts',
  'scripts/blink-cli-ux.test.js',
  'scripts/blink-workflow-prompts.test.js',
  'scripts/blink-cli.integration.test.ts',
  'scripts/blink-bench.integration.test.ts',
  'services/blink/benchmark/scoring.test.ts',
  'scripts/blink-provider-cli.test.ts',
  'scripts/blink-provider-local.test.ts',
  'services/blink/modelCapabilities.test.ts',
  'services/blink/providerErrors.test.ts',
  'services/blink/agent/loopGuard.test.ts',
  'services/blink/context/gitDiffContext.test.ts',
  'services/blink/validateProviderConfig.test.ts',
  'components/blink/BlinkLiveActivity.test.tsx',
  'utils/filePersistence/types.test.ts',
  'utils/blinkStartupLoader.test.ts',
  'utils/earlyInput.test.ts',
  'ink/events/input-event.test.ts',
  'constants/blinkSystemPrompt.test.ts',
]

const extra = process.argv.slice(2)
const args = extra.length > 0 ? ['test', ...extra] : defaultArgs

const result = spawnSync(bun, args, {
  cwd: root,
  stdio: 'inherit',
  shell: false,
})

process.exit(result.status ?? 1)

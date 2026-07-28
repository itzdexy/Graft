#!/usr/bin/env node
/**
 * Build the npm runtime as Bun JavaScript.
 *
 * Tovyr's npm package must contain the product UI and agent runtime, not only
 * a launcher. The result remains Bun/source JavaScript (never tovyr.exe).
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  getTovyrPackageRoot,
  resolveBunExecutable,
} from './tovyr-package-root.js'

const root = getTovyrPackageRoot()
const runtimeDir = join(root, 'runtime')
const entry = join(root, 'entrypoints', 'cli.tsx')

if (!existsSync(entry)) {
  console.error(`Missing Tovyr source entry: ${entry}`)
  process.exit(1)
}

// Optional upstream integrations and build-flagged modules must not block the
// core release bundle. Core provider, UI, and automation modules are bundled.
const external = [
  '@opentelemetry/exporter-*',
  '@anthropic-ai/mcpb',
  '@anthropic-ai/bedrock-sdk',
  '@anthropic-ai/foundry-sdk',
  '@anthropic-ai/vertex-sdk',
  '@aws-sdk/*',
  '@smithy/*',
  '@azure/identity',
  'google-auth-library',
  'sharp',
  'fflate',
  'modifiers-napi',
  '@ant/claude-for-chrome-mcp',
  '*REPLTool.js',
  '*SuggestBackgroundPRTool.js',
  '*TungstenTool.js',
  '*VerifyPlanExecutionTool.js',
  '*SnapshotUpdateDialog.js',
  '*AssistantSessionChooser.js',
  '*commands/assistant/assistant.js',
  '*commands/agents-platform/index.js',
  '*protectedNamespace.js',
  '*snipCompact.js',
  '*cachedMicrocompact.js',
  '*services/contextCollapse/index.js',
  '*verify/SKILL.md',
  '*verify/examples/cli.md',
  '*verify/examples/server.md',
  '*devtools.js',
]

rmSync(runtimeDir, { recursive: true, force: true })
mkdirSync(runtimeDir, { recursive: true })

const result = spawnSync(
  resolveBunExecutable(),
  [
    'build',
    entry,
    '--target=bun',
    '--outdir',
    runtimeDir,
    '--splitting',
    '--minify-syntax',
    ...external.flatMap(specifier => ['--external', specifier]),
  ],
  {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  },
)

if (result.error) {
  console.error(`Tovyr runtime build failed: ${result.error.message}`)
  process.exit(1)
}
if (result.status !== 0 || !existsSync(join(runtimeDir, 'cli.js'))) {
  console.error(`Tovyr runtime build failed (exit ${result.status ?? 1})`)
  process.exit(result.status ?? 1)
}

console.log('Tovyr npm runtime ready: runtime/cli.js')

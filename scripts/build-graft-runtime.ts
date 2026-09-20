import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const root = join(import.meta.dir, '..')
const outputDir = process.env.GRAFT_RUNTIME_OUTPUT_DIR
  ? resolve(root, process.env.GRAFT_RUNTIME_OUTPUT_DIR)
  : join(root, '.cache', 'runtime')
const entryName = process.env.GRAFT_RUNTIME_ENTRY_NAME || 'graft-cli.js'
const packageMode = process.env.GRAFT_RUNTIME_BUNDLE_PACKAGES === '1'
  ? 'bundle'
  : 'external'
const emptyStandaloneModules = new Set([
  'src/tools/TungstenTool/TungstenTool.js',
])

// The upstream source references optional/enterprise modules that are absent
// from the standalone Graft checkout. They are all behind runtime feature
// gates; leaving them external preserves that behavior while allowing Bun to
// collapse the available source graph into one fast-loading module.
const optionalModules = new Set([
  './protectedNamespace.js',
  '../services/compact/snipCompact.js',
  './cachedMicrocompact.js',
  './components/agents/SnapshotUpdateDialog.js',
  './assistant/AssistantSessionChooser.js',
  './commands/assistant/assistant.js',
  './commands/agents-platform/index.js',
  '../../tools/TungstenTool/TungstenTool.js',
  './tools/REPLTool/REPLTool.js',
  './tools/SuggestBackgroundPRTool/SuggestBackgroundPRTool.js',
  './tools/TungstenTool/TungstenTool.js',
  './tools/VerifyPlanExecutionTool/VerifyPlanExecutionTool.js',
  './verify/SKILL.md',
  './verify/examples/cli.md',
  './verify/examples/server.md',
  './devtools.js',
  '../services/contextCollapse/index.js',
  'src/tools/TungstenTool/TungstenTool.js',
  '@anthropic-ai/bedrock-sdk',
  '@anthropic-ai/foundry-sdk',
  '@anthropic-ai/vertex-sdk',
  '@anthropic-ai/mcpb',
  '@aws-sdk/client-bedrock',
  '@aws-sdk/client-bedrock-runtime',
  '@aws-sdk/client-sts',
  '@aws-sdk/credential-provider-node',
  '@azure/identity',
  '@opentelemetry/exporter-logs-otlp-grpc',
  '@opentelemetry/exporter-logs-otlp-http',
  '@opentelemetry/exporter-logs-otlp-proto',
  '@opentelemetry/exporter-metrics-otlp-grpc',
  '@opentelemetry/exporter-metrics-otlp-http',
  '@opentelemetry/exporter-metrics-otlp-proto',
  '@opentelemetry/exporter-prometheus',
  '@opentelemetry/exporter-trace-otlp-grpc',
  '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/exporter-trace-otlp-proto',
  '@smithy/core',
  '@smithy/node-http-handler',
  'fflate',
  'google-auth-library',
  'modifiers-napi',
  'audio-capture-napi',
  'sharp',
])

/**
 * The source checkout intentionally omits enterprise/daemon modules. Bun's
 * bundler still resolves dynamic import() and require() targets, however, so
 * a missing .js specifier aborts the entire warm build before feature gates
 * can run. Treat only missing relative source files as empty optional modules;
 * installed package dependencies remain external below.
 */
function missingLocalModule(importer: string | undefined, request: string): string | null {
  const candidate = request.startsWith('src/')
    ? resolve(root, request)
    : importer && request.startsWith('.')
      ? resolve(dirname(importer), request)
      : null
  if (!candidate) return null
  const sourceCandidates = [
    candidate,
    `${candidate}.js`,
    `${candidate}.mjs`,
    `${candidate}.cjs`,
    `${candidate}.json`,
    join(candidate, 'index.js'),
    join(candidate, 'index.mjs'),
    candidate.replace(/\.js$/, '.ts'),
    candidate.replace(/\.js$/, '.tsx'),
    candidate.replace(/\.js$/, '.jsx'),
    candidate.replace(/\.md$/, '.md'),
  ]
  return sourceCandidates.some(path => existsSync(path)) ? null : candidate
}

const missingExports = new Map<string, Set<string>>()

function recordMissingExports(path: string, importer: string | undefined, request: string): void {
  if (!importer) return
  try {
    const source = readFileSync(importer, 'utf8')
    const escaped = request.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
    const names = new Set(missingExports.get(path) ?? [])
    const named = source.match(new RegExp('(?:import|export)\\s+(?:type\\s+)?\\{([^}]+)\\}\\s+from[^;\\n]*' + escaped))
    for (const entry of named?.[1]?.split(',') ?? []) {
      const name = entry.trim().split(/\s+as\s+/)[0]
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) names.add(name)
    }
    const defaultImport = source.match(new RegExp('import\\s+([A-Za-z_$][\\w$]*)\\s*(?:,|from)[^;\\n]*' + escaped))
    if (defaultImport?.[1]) names.add('default')
    missingExports.set(path, names)
  } catch {
    // A missing optional module must never make the warm build fail again.
  }
}

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(outputDir, { recursive: true })
const result = await Bun.build({
  entrypoints: [join(root, 'src', 'entrypoints', 'cli.tsx')],
  outdir: outputDir,
  naming: {
    entry: entryName,
    chunk: 'chunks/[name]-[hash].[ext]',
  },
  target: 'bun',
  format: 'esm',
  splitting: true,
  packages: packageMode,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  sourcemap: 'none',
  minify: false,
  plugins: [
    {
      name: 'graft-optional-modules',
      setup(build) {
        build.onResolve({ filter: /.*/ }, args =>
          emptyStandaloneModules.has(args.path)
            ? { path: args.path, namespace: 'graft-empty' }
            : undefined,
        )
        build.onLoad({ filter: /.*/, namespace: 'graft-empty' }, args => {
          const names = new Set(['TungstenTool', ...(missingExports.get(args.path) ?? [])])
          const exports = [...names].map(name =>
            name === 'default' ? 'export default undefined' : 'export const ' + name + ' = undefined',
          )
          if (!names.has('default')) exports.push('export default undefined')
          return { contents: exports.join('; '), loader: 'js' }
        })
        build.onResolve({ filter: /.*/ }, args => {
          const missing = missingLocalModule(args.importer, args.path)
          if (missing) {
            recordMissingExports(missing, args.importer, args.path)
            return { path: missing, namespace: 'graft-empty' }
          }
          return optionalModules.has(args.path)
            ? { path: args.path, external: true }
            : undefined
        })
      },
    },
  ],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

const output = result.outputs.find(item =>
  item.path.endsWith(entryName),
)
// Report the whole split graph. The entry chunk alone is a few KB, which
// rounded to a misleading "0 MB" while the real bundle was ~13 MB of chunks.
const totalBytes = result.outputs.reduce((sum, item) => sum + item.size, 0)
console.log(
  `Built ${output?.path ?? 'Graft runtime'} (${result.outputs.length} chunks, ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`,
)

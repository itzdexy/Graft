#!/usr/bin/env node
/**
 * Flag UI components and warmers that are defined but never referenced.
 *
 * On 2026-08-24 four finished pieces of Tovyr shipped with zero call sites:
 * TovyrGitHubUpdateNotice, TovyrSilentTurnNotice, prefetchActiveProviderModelIds,
 * and the streamingThinking prop path. Each was valid TypeScript and passed
 * every test — an unmounted export is not a type error, so neither tsc nor the
 * unit suite can see it. The user found all four by launching the app and
 * reporting "it doesn't show anything".
 *
 * This is deliberately narrow: exported components under components/tovyr and
 * exported Tovyr-runtime prefetch/warm helpers. A general dead-export scan over this repo
 * produces hundreds of hits (SDK surface, re-exports, ant-only paths) and gets
 * ignored, which is worse than not running it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.claude', 'dist', 'build-output', 'packages', 'website', 'vendor',
])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const SOURCE_ROOTS = [
  'commands', 'components', 'entrypoints', 'hooks', 'performance', 'screens',
  'services', 'tools', 'utils',
]
const SOURCE_FILES = ['commands.ts', 'main.tsx', 'query.ts', 'tools.ts']
const files = [
  ...SOURCE_ROOTS.flatMap(dir => {
  const full = join(ROOT, dir)
  try {
    return statSync(full).isDirectory() ? walk(full) : []
  } catch {
    return []
  }
  }),
  ...SOURCE_FILES.map(file => join(ROOT, file)).filter(file => {
    try { return statSync(file).isFile() } catch { return false }
  }),
]
const sources = new Map()
for (const f of files) {
  const rel = relative(ROOT, f).split(sep).join('/')
  if (/\.(?:test|spec)\.tsx?$/.test(rel)) continue
  try { sources.set(f, readFileSync(f, 'utf8')) } catch { /* unreadable */ }
}

const sourceFiles = new Map(
  [...sources].map(([file, source]) => [
    file,
    ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
  ]),
)

function isExported(node) {
  return !!node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
}

function resolveImport(from, specifier) {
  if (!specifier.startsWith('.')) return undefined
  const base = resolve(from, '..', specifier).replace(/\.js$/, '')
  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + suffix
    if (sourceFiles.has(candidate)) return candidate
  }
  return undefined
}

function importedRuntimeNames(file, candidate) {
  const aliases = new Set()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue
    const moduleName = statement.moduleSpecifier
    if (!ts.isStringLiteral(moduleName)) continue
    if (resolveImport(file.fileName, moduleName.text) !== candidate.file) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue
      if ((element.propertyName?.text ?? element.name.text) === candidate.name) {
        aliases.add(element.name.text)
      }
    }
  }
  const visitDynamicImport = node => {
    if (!ts.isVariableDeclaration(node) || !node.initializer || !ts.isObjectBindingPattern(node.name)) {
      return ts.forEachChild(node, visitDynamicImport)
    }
    const initializer = ts.isAwaitExpression(node.initializer)
      ? node.initializer.expression
      : node.initializer
    if (!ts.isCallExpression(initializer) || initializer.expression.kind !== ts.SyntaxKind.ImportKeyword) return
    const [moduleName] = initializer.arguments
    if (!moduleName || !ts.isStringLiteral(moduleName)) return
    if (resolveImport(file.fileName, moduleName.text) !== candidate.file) return
    for (const element of node.name.elements) {
      if ((element.propertyName?.text ?? element.name.text) === candidate.name && ts.isIdentifier(element.name)) {
        aliases.add(element.name.text)
      }
    }
  }
  ts.forEachChild(file, visitDynamicImport)
  return aliases
}

function isLiteralBoolean(node, value) {
  return value
    ? node.kind === ts.SyntaxKind.TrueKeyword
    : node.kind === ts.SyntaxKind.FalseKeyword
}

/** A value import counts only when it produces JSX or calls a warmer at runtime. */
function hasRuntimeUse(file, aliases, isComponent) {
  if (aliases.size === 0) return false
  const runtimeAliases = new Set(aliases)
  let changed = true
  while (changed) {
    changed = false
    const collectAliases = node => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const initializerNames = ts.isIdentifier(node.initializer)
          ? [node.initializer.text]
          : ts.isConditionalExpression(node.initializer)
            ? [node.initializer.whenTrue, node.initializer.whenFalse]
                .filter(ts.isIdentifier)
                .map(expression => expression.text)
            : []
        if (initializerNames.some(name => runtimeAliases.has(name)) && !runtimeAliases.has(node.name.text)) {
          runtimeAliases.add(node.name.text)
          changed = true
        }
      }
      ts.forEachChild(node, collectAliases)
    }
    ts.forEachChild(file, collectAliases)
  }
  let used = false
  const visit = (node, unreachable = false) => {
    if (used || unreachable) return
    if (ts.isIfStatement(node)) {
      visit(node.expression)
      visit(node.thenStatement, isLiteralBoolean(node.expression, false))
      if (node.elseStatement) visit(node.elseStatement, isLiteralBoolean(node.expression, true))
      return
    }
    if (isComponent && (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))) {
      const tag = node.tagName
      if (ts.isIdentifier(tag) && runtimeAliases.has(tag.text)) used = true
      if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression) && runtimeAliases.has(tag.expression.text)) used = true
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && runtimeAliases.has(node.expression.text)) {
      used = true
    }
    if (isComponent && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createElement') {
      const [component] = node.arguments
      if (component && ts.isIdentifier(component) && runtimeAliases.has(component.text)) used = true
    }
    ts.forEachChild(node, child => visit(child, unreachable))
  }
  for (const statement of file.statements) visit(statement)
  return used
}

/** Exported names we care about, with the file that defines them. */
const candidates = []
for (const [file, src] of sources) {
  const rel = relative(ROOT, file).split(sep).join('/')
  if (/\.test\.tsx?$/.test(rel)) continue

  const isTovyrComponent = rel.startsWith('components/tovyr/')
  const parsed = sourceFiles.get(file)
  for (const statement of parsed.statements) {
    const names = []
    if (ts.isFunctionDeclaration(statement) && isExported(statement) && statement.name) names.push(statement.name.text)
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
      }
    }
    for (const name of names) {
      const isComponent = isTovyrComponent && /^Tovyr[A-Z]/.test(name)
      const isWarmer = rel.startsWith('services/tovyr/') && /^(prefetch|warm)[A-Z]/.test(name)
      if (isComponent || isWarmer) candidates.push({ name, rel, file, isComponent })
    }
  }
}

const dead = []
for (const candidate of candidates) {
  let live = false
  for (const [file, parsed] of sourceFiles) {
    const other = relative(ROOT, file).split(sep).join('/')
    if (other === candidate.rel) continue
    const aliases = importedRuntimeNames(parsed, candidate)
    if (hasRuntimeUse(parsed, aliases, candidate.isComponent)) {
      live = true
      break
    }
  }
  if (!live) dead.push(candidate)
}

/**
 * The check intentionally has no legacy exemptions. A component or warmer
 * must have a reachable caller before it can land in the workbench.
 */
const BASELINE = new Set([])

const fresh = dead.filter(d => !BASELINE.has(d.name))
const stale = [...BASELINE].filter(name => !dead.some(d => d.name === name))

if (stale.length > 0) {
  console.log(
    `check-dead-ui: ${stale.length} baseline entries are now referenced — ` +
      `remove from BASELINE: ${stale.join(", ")}`,
  )
}

if (fresh.length === 0) {
  console.log(
    `check-dead-ui: no NEW unreferenced components (${dead.length} baselined).`,
  )
  process.exit(0)
}

console.error('check-dead-ui: these are defined but never referenced anywhere:')
for (const { name, rel } of fresh) console.error(`  ${name}  (${rel})`)
console.error(
  'Either wire it into the UI or delete it. A finished component with no ' +
  'call site is the exact shape of bug this check exists to catch.',
)
process.exit(1)

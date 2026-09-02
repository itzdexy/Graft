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
 * This is deliberately narrow: exported components under src/components/tovyr and
 * exported Tovyr-runtime prefetch/warm helpers. A general dead-export scan over this repo
 * produces hundreds of hits (SDK surface, re-exports, ant-only paths) and gets
 * ignored, which is worse than not running it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SRC_ROOT = join(ROOT, 'src')
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
  const full = join(SRC_ROOT, dir)
  try {
    return statSync(full).isDirectory() ? walk(full) : []
  } catch {
    return []
  }
  }),
  ...SOURCE_FILES.map(file => join(SRC_ROOT, file)).filter(file => {
    try { return statSync(file).isFile() } catch { return false }
  }),
]
const sources = new Map()
for (const f of files) {
  const rel = relative(SRC_ROOT, f).split(sep).join('/')
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

/** A value import counts only when it produces JSX or calls a warmer at runtime.
 *
 * This deliberately follows bindings rather than globally guessing by identifier
 * text. A local `Ghost` parameter must not make an imported `Ghost` live, and a
 * JSX node below `false &&` is not a production route. It is intentionally a
 * small, conservative flow analysis: it proves direct aliases and wrappers such
 * as `const Wrapped = memo(Ghost)`; it never treats an arbitrary string or a
 * same-spelled binding in another scope as a reference.
 */
function hasRuntimeUse(file, aliases, isComponent) {
  if (aliases.size === 0) return false
  let used = false

  const isLiveAlias = (node, scope) =>
    ts.isIdentifier(node) && scope.get(node.text) === true

  const expressionCarriesAlias = (node, scope) => {
    while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      node = node.expression
    }
    if (isLiveAlias(node, scope)) return true
    if (ts.isConditionalExpression(node)) {
      if (isLiteralBoolean(node.condition, true)) return expressionCarriesAlias(node.whenTrue, scope)
      if (isLiteralBoolean(node.condition, false)) return expressionCarriesAlias(node.whenFalse, scope)
      return expressionCarriesAlias(node.whenTrue, scope) || expressionCarriesAlias(node.whenFalse, scope)
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return !isLiteralBoolean(node.left, false) && expressionCarriesAlias(node.right, scope)
    }
    // React wrappers (memo, forwardRef, or a local HOC) keep a component live
    // only when their result is subsequently rendered. The call itself is not a
    // runtime use for a warmer, so this is alias propagation rather than usage.
    return ts.isCallExpression(node) && node.arguments.some(argument => expressionCarriesAlias(argument, scope))
  }

  const bindPattern = (name, scope, value = false) => {
    if (ts.isIdentifier(name)) scope.set(name.text, value)
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) bindPattern(element.name, scope, value)
      }
    }
  }

  const visit = (node, scope, unreachable = false) => {
    if (used || unreachable) return
    if (ts.isIfStatement(node)) {
      visit(node.expression, scope)
      visit(node.thenStatement, new Map(scope), isLiteralBoolean(node.expression, false))
      if (node.elseStatement) visit(node.elseStatement, new Map(scope), isLiteralBoolean(node.expression, true))
      return
    }
    if (ts.isConditionalExpression(node)) {
      visit(node.condition, scope)
      visit(node.whenTrue, new Map(scope), isLiteralBoolean(node.condition, false))
      visit(node.whenFalse, new Map(scope), isLiteralBoolean(node.condition, true))
      return
    }
    if (ts.isBinaryExpression(node)) {
      visit(node.left, scope)
      const op = node.operatorToken.kind
      const rightUnreachable =
        (op === ts.SyntaxKind.AmpersandAmpersandToken && isLiteralBoolean(node.left, false)) ||
        (op === ts.SyntaxKind.BarBarToken && isLiteralBoolean(node.left, true))
      visit(node.right, scope, rightUnreachable)
      return
    }
    if (ts.isBlock(node) || ts.isModuleBlock(node)) {
      const local = new Map(scope)
      for (const statement of node.statements) visit(statement, local)
      return
    }
    // Declarations introduce their name into the containing block. Treat a
    // same-spelled local declaration as a shadow before visiting its body so
    // `<Ghost />` cannot accidentally keep an imported Ghost alive.
    if (ts.isFunctionDeclaration(node)) {
      if (node.name) scope.set(node.name.text, false)
      const local = new Map(scope)
      for (const parameter of node.parameters) bindPattern(parameter.name, local)
      if (node.body) visit(node.body, local)
      return
    }
    if (ts.isClassDeclaration(node)) {
      if (node.name) scope.set(node.name.text, false)
      const local = new Map(scope)
      ts.forEachChild(node, child => visit(child, local))
      return
    }
    if (ts.isFunctionLike(node)) {
      const local = new Map(scope)
      for (const parameter of node.parameters) bindPattern(parameter.name, local)
      if (node.body) visit(node.body, local)
      return
    }
    if (ts.isVariableDeclaration(node)) {
      if (node.initializer) visit(node.initializer, scope)
      const initializer = node.initializer && ts.isAwaitExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer
      const isDynamicImportBinding =
        !!initializer &&
        ts.isCallExpression(initializer) &&
        initializer.expression.kind === ts.SyntaxKind.ImportKeyword
      // `const { Ghost } = await import('./Ghost.js')` is both the import
      // declaration and its local binding. importedRuntimeNames already proved
      // the module/property match, so retain that binding here instead of
      // treating the destructure as an unrelated shadow.
      const bindingValue = isDynamicImportBinding && ts.isObjectBindingPattern(node.name)
        ? [...node.name.elements].some(element =>
            ts.isBindingElement(element) && ts.isIdentifier(element.name) && scope.get(element.name.text) === true,
          )
        : !!node.initializer && expressionCarriesAlias(node.initializer, scope)
      bindPattern(node.name, scope, bindingValue)
      return
    }
    if (isComponent && (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))) {
      const tag = node.tagName
      if (ts.isIdentifier(tag) && scope.get(tag.text) === true) used = true
      if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression) && scope.get(tag.expression.text) === true) used = true
    }
    // Routers and composition shells commonly receive a component value via
    // JSX (for example `<Route component={Ghost} />`). That is a runtime
    // owner, not a textual mention, so retain the imported binding.
    if (
      isComponent &&
      ts.isJsxExpression(node) &&
      ts.isJsxAttribute(node.parent) &&
      node.expression &&
      expressionCarriesAlias(node.expression, scope)
    ) {
      used = true
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && scope.get(node.expression.text) === true) {
      used = true
    }
    if (isComponent && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createElement') {
      const [component] = node.arguments
      if (component && isLiveAlias(component, scope)) used = true
    }
    ts.forEachChild(node, child => visit(child, scope))
  }

  const rootScope = new Map([...aliases].map(alias => [alias, true]))
  for (const statement of file.statements) visit(statement, rootScope)
  return used
}

/** Exported names we care about, with the file that defines them. */
const candidates = []
for (const [file, src] of sources) {
  const rel = relative(SRC_ROOT, file).split(sep).join('/')
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
    const other = relative(SRC_ROOT, file).split(sep).join('/')
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

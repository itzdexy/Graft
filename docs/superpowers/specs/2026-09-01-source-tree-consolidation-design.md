# Tovyr Source-Tree Consolidation Design

## Purpose

Consolidate Tovyr's application code under `src/`, remove files that do not
participate in the product, and leave a repository layout that is easier to
audit and maintain. The target shape follows the broad convention used by
OpenClaude—application code in `src/`, operational tooling at the root—without
copying OpenClaude code, branding, or project-specific subsystems.

This migration is a maintainability and provenance improvement. A directory
layout does not determine copyright status and cannot prevent a legal claim.

## Target Repository Shape

The repository root will contain only project infrastructure and independently
useful product surfaces:

```text
.github/          CI and repository automation
assets/           Tovyr-owned static assets
bin/              executable launchers
docs/             maintained documentation
mcps/             bundled MCP definitions used by Tovyr
packages/         separately built workspace packages
scripts/          build, release, validation, and maintenance scripts
src/              Tovyr application source and co-located unit tests
tests/            cross-cutting fixtures and integration/smoke tests
vendor/           explicit local dependency shims
```

Normal root configuration and policy files remain at the root. The
`chrome-extension/` tree will be removed as requested, along with its build,
launcher, documentation, and runtime references.

## Source Migration

All TypeScript and TSX modules that form the Tovyr CLI will move beneath
`src/`. This includes entrypoints, UI components, commands, tools, services,
provider logic, state, utilities, and their co-located unit tests. Root modules
such as `main.tsx`, `query.ts`, `QueryEngine.ts`, and `tools.ts` will become
`src/<name>` so their relative relationships remain recognizable.

Configuration will be updated as one atomic migration:

- `src/*` aliases will resolve to `./src/*`.
- Bun preload paths will point into `src/build/`.
- CLI launchers and runtime builders will resolve `src/entrypoints/cli.tsx`.
- TypeScript project roots and explicit file lists will use `src/` paths.
- CI, package scripts, documentation, and maintenance scripts will stop
  referring to the old root source paths.
- Local package references will be updated if a required source package moves.

The npm package remains named and launched as Tovyr. The migration does not
introduce OpenClaude names or commands.

## Removal Policy

A file or directory may be removed when it satisfies at least one of these
conditions and has no verified product consumer:

1. It is outside the CLI entrypoint import graph and is not a configured build,
   package, test, documentation, or release input.
2. It is a generated local artifact, including logs, captured command output,
   backup files, package archives, caches, or temporary build directories.
3. It is generic placeholder scaffolding that advertises a subsystem but is
   not integrated into Tovyr, tested, or documented as supported behavior.
4. It belongs exclusively to the removed Chrome extension.
5. It duplicates a maintained implementation elsewhere in the repository.

Examples of candidate placeholder trees include the isolated `actors/`,
`architecture/`, `workflow/`, and similar generic single-file subsystems.
Each candidate will be checked for imports, script references, package exports,
and documentation links before deletion. Files will not be removed solely
because their prose or style appears generated.

Generated artifacts currently visible at the root—test output captures, logs,
backup files, file listings, the `nul` artifact, and packed npm tarballs—will be
deleted and covered by ignore rules where appropriate.

## Provenance and Project Identity

Tovyr will keep its own name, configuration paths, commands, launch behavior,
documentation, and assets. A concise provenance notice will distinguish Tovyr
code and modifications without claiming that a layout change alters ownership
of any pre-existing code. Existing legal notices will not be silently replaced
or broadened; any uncertain copyright or licensing statements will be called
out for maintainer and legal review.

## Compatibility

The user-visible CLI contract remains unchanged:

- `tovyr` starts the interactive Bun/source UI.
- `tovyr --help` and `tovyr --version` retain their fast paths.
- `/init` creates `tovyr.md`.
- `/plan`, `/code`, `/provider`, and `/model` retain their behavior.
- Provider credentials remain outside the repository and are never migrated.
- Tovyr continues to run from the user's project working directory.

Chrome-extension commands, onboarding, manifests, native-host setup, and UI
surfaces are intentionally removed. Where a shared browser capability does not
depend on the extension, it may remain; extension-only code must not.

## Migration Safety

The working tree contains extensive existing modifications. Moves will preserve
file contents and history where Git can detect renames. Unrelated user edits
will not be reverted, reformatted, or included in cleanup decisions. Before a
destructive directory removal, its resolved path and references will be checked.

The migration will be performed in reviewable groups:

1. Remove proven artifacts and dead placeholder subsystems.
2. Remove the Chrome extension and extension-only integrations.
3. Move retained application source beneath `src/`.
4. Update build, test, launcher, import, and documentation paths.
5. Run validation and repair only migration-caused failures.

## Validation

The completed migration must pass, or explicitly document pre-existing
failures for, the following checks:

```text
npm run check:brand
npm run check:dead-ui
npm run typecheck
npm test
npm run build:runtime
bun run src/entrypoints/cli.tsx --version
node bin/tovyr.js --version
npm run publish:npm:dry-run
```

Additional focused tests will cover launcher path resolution and ensure no
remaining source or documentation reference points to `chrome-extension/` or
the old root-level entrypoint.

## Completion Criteria

The work is complete when application source is under `src/`, the Chrome
extension and verified dead material are gone, all path consumers are updated,
Tovyr's supported CLI behavior remains intact, and validation results are
recorded without representing the restructuring as a legal guarantee.

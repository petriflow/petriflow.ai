# AGENTS.md

MCP server for Petriflow, built on [xmcp](https://xmcp.dev) + Fastify. Tools are auto-discovered from
`src/ts/tools/*.tool.ts`.

## Commands

- `pnpm dev` — build then run
- `pnpm build` — `xmcp build && node build.mjs` (regenerate `.xmcp/`, bundle to `dist/server.cjs`, copy `src/public` →
  `dist/public` and `src/groovy` → `dist/groovy`)
- `pnpm typecheck` — `tsc --noEmit -p tsconfig.test.json` (type-check source, tests, and Vitest config)
- `pnpm test` — run Vitest once (`vitest run`)
- `pnpm start` — run the already-built server (`node dist/server.cjs`)

Package manager is pnpm (Node 26.x). `pnpm-workspace.yaml` allows esbuild postinstall builds.

## Tests

- Tests live under `test/`, grouped by area (`test/services/`, `test/routes/`). Do not add tests under `src/`.
- Use Vitest (`import {expect, test, vi} from "vitest"`) and add tests to `pnpm test` discovery (`vitest.config.mts`).
  The test environment is Node.
- Vitest requires Vite internally as a peer dependency; do not add a Vite app config or replace the xmcp/esbuild
  production build with Vite.
- `tsconfig.test.json` includes both `src/**/*.ts` and `test/**/*.ts`; preserve test type-checking when changing
  TypeScript configuration.
- Keep service tests isolated from network and external processes. Use fake fetchers, temporary filesystem paths, and
  mocked/fake subprocesses where needed.

## Build pipeline (non-obvious)

- `xmcp build` generates `.xmcp/` (adapter + `import-map.js`). These are generated — never hand-edit.
- `tsconfig.json` maps `@xmcp/*` → `./.xmcp/*`, so `@xmcp/adapter` resolves to the generated adapter.
- esbuild outputs CJS (`format: cjs`), so code relies on `__dirname` at runtime (see `src/ts/services/*`).
- `xmcp-env.d.ts` is generated — do not edit.

## Tool authoring

Each `src/ts/tools/*.tool.ts` exports `schema` (zod inputs), optional `outputSchema`, `metadata`, and a `default` async
function.

Return convention:

- Tools with an `outputSchema` must return `{ structuredContent: { ... } }` (see `list_actions.tool.ts`,
  `list_examples.tool.ts`).
- Tools returning plain text return the string directly (see `get_schema.tool.ts`, `overview.tool.ts`).

## Versioning

- `src/ts/services/release-sync.service.ts` fetches paginated GitHub release metadata for `petriflow/petriflow`, caches
  the version list and latest stable version, and synchronizes missing published releases.
- Release assets are named `petriflow-vX.Y.Z.zip`. The archive root contains `petriflow.schema.xsd`, `overview.md`,
  `actions-definitions.json`, `elements/`, and `examples/`.
- `components-definitions.json` (field components, keyed by definition id with `names`, `fieldTypes`, `whenToUse`,
  `params`) currently exists only in `src/petriflow/snapshot/`. It is hand-written from `netgrif/components` v7.0.3
  (`data-fields.module.ts` registry plus `component.properties` reads), is not required by release validation, and
  `list_components`/`get_component` fail with "not found for version" on releases that lack it.
- `PETRIFLOW_MODE` defaults to `REMOTE`. Synchronization runs before listening in REMOTE and can be retried through
  `POST /admin/petriflow/sync`; LOCAL returns HTTP 409 from that endpoint. Deployment infrastructure is responsible for
  endpoint authentication.
- `storage.service.ts` persists extracted release files under a versioned directory rooted at
  `StorageService.STORAGE_PATH` (`__dirname/storage`). A version becomes available only after a complete atomic install.
  Installed releases are immutable: synchronization does not overwrite or delete them.
- `cache.service.ts` is only for cache data (including release version metadata); release files belong in
  `storage.service.ts`.
- Tools and resources resolve `"latest"` through the active version catalog. `list-versions` no longer needs to be
  called first.
- In LOCAL, `src/petriflow/snapshot/` is the explicit checked-in snapshot source; `build.mjs` copies it to
  `dist/petriflow/snapshot/` and startup installs only that version. Do not add implicit fallback behavior: REMOTE never
  substitutes the bundle.

## Logging

- Use `getLogger()` from `src/ts/services/logger.service`. Never `console.log`.
- Do NOT pass a pino instance to `Fastify({logger})`: esbuild bundles pino separately from Fastify's copy, so Fastify's
  `instanceof pino` check fails. Pass a config object and call `setLogger(app.log)` (already done in `src/ts/index.ts`).

## HTTP binding

- `PORT` defaults to `3000`; `HOST` defaults to `127.0.0.1` for local use. The Docker image sets `HOST=0.0.0.0` so
  published container ports are reachable.

## Services

- `src/ts/services/cache.service.ts` — file-backed key-value cache singleton; the default file is `cache.json` under
  `__dirname`. It is for metadata/cache values, not release files.
- `src/ts/services/storage.service.ts` — versioned release-file storage with atomic install and read/list helpers. Its
  production path is intentionally unchanged.
- `src/ts/services/release-sync.service.ts` — GitHub release listing, SemVer latest selection, ZIP validation,
  synchronization, and version metadata cache.
- `src/ts/services/petriflow-snapshot.service.ts` — validates and installs the checked-in snapshot in LOCAL mode.
- `src/ts/services/petriflow-version.service.ts` — mode-selected version catalog for listing, latest resolution, and
  version validation.
- `src/ts/services/feature-flags.service.ts` — parses startup disabled-name lists; rules use `name` and tools use XMCP
  `metadata.name`.
- `src/ts/services/petriflow-runtime.service.ts` — selects local snapshot initialization or remote synchronization
  before listening.
- `src/ts/services/singleton-registry.service.ts` — registry on
  `globalThis[Symbol.for("netgrif.petriflow.ai.services")]` for default service instances shared across the main bundle
  and XMCP adapter module graph. Use stable namespaced keys; do not add a production reset.
- `src/ts/services/petriflow-data.service.ts` — shared readers for schema, overview, elements, action definitions, and
  examples. Tools, resources, and validation should use this service rather than reading files directly.
- `src/ts/services/version-completions.service.ts` — resource-template completion values from the active catalog;
  completion must not fetch from GitHub.
- `src/ts/services/logger.service.ts` — `getLogger()` returns the process-shared logger and `setLogger()` updates it;
  call `getLogger()` rather than capturing a module-local logger binding.
- `src/ts/services/utils.ts` — latest-version helper.
- `src/ts/services/schema.service.ts` — `getSchemaXsd(version)` delegates to `PetriflowDataService` (used by
  `get-schema` tool and `ValidationService`).
- `src/ts/services/validation.service.ts` — `ValidationService` singleton (default export). `validate(xml, version)`
  runs: well-formedness → XSD validation (`libxmljs5`) → registered semantic rules. Rules are registered at startup in
  `src/ts/index.ts`.
- `src/ts/services/action-validation.service.ts` — action/function compilation through a persistent Groovy subprocess.
  Pure reference helpers can be tested directly; daemon tests should use a fake child process rather than require
  Groovy.

## MCP Resources

- Resources are auto-discovered from `src/ts/resources/`; route groups in parentheses set the URI scheme and `[param]`
  segments create templates.
- Petriflow resources are grouped under `(petriflow)/versions/`. Every dynamic resource handler must export a default
  handler; export `complete` from each resource with a `{version}` parameter using the shared version-completion
  service.
- Resources and tools should call the same Petriflow data service. Structured tool payloads are represented as JSON text
  resources; file content is returned as text with an appropriate MIME type.

## Validation rules

- Semantic rules live in `src/ts/services/rules/*.rule.ts`, each exporting a `ValidationRule`
  (`{ name, description, validate(doc, ctx) }`).
- Register new rules in `src/ts/services/rules/index.ts` (`rules` array); they are wired into the service on startup.
- `src/ts/index.ts` registers only rules enabled by the feature-flag service; XML parsing and XSD validation are not
  feature-flagged.
- `src/ts/services/rules/helpers.ts` has shared DOM/XPath helpers (`childText`, `findRootChildren`, `isJavaIdentifier`,
  `JAVA_RESERVED_WORDS`, `GROOVY_RESERVED_WORDS`, `parseInteger`).
- `validate(doc, ctx)` receives a libxmljs5 `Document`; use `doc.find(xpath)` / element `.attr()` / `.text()`.
- `validate` may return a `Promise<ValidationIssue[]>` (the service `await`s every rule); `action-validation.rule.ts` is
  async (it drives the Groovy daemon).

## Native module: libxmljs5 (non-obvious)

- XML/XSD validation uses `libxmljs5`, a **native addon** (not pure JS). It must NOT be bundled:
  - `build.mjs` lists `external: ['libxmljs5']`.
  - Locally it needs to be compiled — pnpm build is enabled via `allowBuilds.libxmljs5 = true` in `pnpm-workspace.yaml`
    (and it needs `python3 make g++ libxml2-dev` to build from source; see `Dockerfile` build stage).
- The `.node` binary is required at runtime and is loaded via `require("libxmljs5")`, so the runtime image must contain
  `node_modules` (see `Dockerfile`).

## Feature flags

- `PETRIFLOW_DISABLED_RULES` and `PETRIFLOW_DISABLED_TOOLS` are comma-separated startup lists. Empty or unset lists
  leave all features enabled; unknown names are warned about and ignored.
- Every discovered tool's `metadata` must use `withToolFeatureFlag(...)`. When adding or renaming a tool, update
  `knownToolNames` in `src/ts/services/feature-flags.service.ts` to keep unknown-name validation accurate.

## Docker

- The Docker build uses Corepack/pnpm with `pnpm-lock.yaml` and `pnpm-workspace.yaml`; preserve `--frozen-lockfile` and
  copy the workspace config before install so native build permissions apply.
- Builder and runtime share the `node:26-alpine3.24` image so `libxmljs5` is built for the runtime ABI. The image tag
  follows Node 26 patch releases while keeping the Alpine release line fixed.
- Groovy 4.0.33 is downloaded from Apache and SHA-256 verified. Update its version and checksum together.
- The application defaults to `HOST=127.0.0.1`; the container sets `HOST=0.0.0.0` for published ports.
- Runtime writes `dist/cache.json` and `dist/storage`; the image makes `dist` writable by `node` and declares
  `/app/dist/storage` as a volume. Deployments should use a named volume there.
- The `node:26-alpine3.24` image tag follows Node 26 patch releases while keeping the Alpine line fixed, and the pnpm
  lockfile pins the application dependency graph. `apk add` still resolves packages from Alpine repositories at build
  time; for byte-for-byte image reproducibility, also pin/snapshot those OS packages and update them regularly for
  security fixes.

## Notes

- `.github/workflows/ci.yml` runs typecheck, tests, and build for pull requests and pushes to `main`.
- `.github/workflows/release.yml` validates `vX.Y.Z` tags against `package.json`, then publishes a GitHub Release and
  Docker Hub image. Releases require the `DOCKERHUB_IMAGE` repository variable and the `DOCKERHUB_USERNAME` and
  `DOCKERHUB_TOKEN` repository secrets.

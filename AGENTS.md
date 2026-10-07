# AGENTS.md

MCP server for Petriflow, built on [xmcp](https://xmcp.dev) + Fastify. Tools are auto-discovered from `src/ts/tools/*.tool.ts`.

## Commands

- `pnpm dev` — build then run
- `pnpm build` — `xmcp build && node build.mjs` (regenerate `.xmcp/`, bundle to `dist/server.cjs`, copy `src/public` → `dist/public` and `src/groovy` → `dist/groovy`)
- `pnpm typecheck` — `tsc --noEmit -p tsconfig.test.json` (type-check source, tests, and Vitest config)
- `pnpm test` — run Vitest once (`vitest run`)
- `pnpm start` — run the already-built server (`node dist/server.cjs`)

Package manager is pnpm (Node >= 22.12.0). `pnpm-workspace.yaml` allows esbuild postinstall builds.

## Tests

- Tests live under `test/`, grouped by area (`test/services/`, `test/routes/`). Do not add tests under `src/`.
- Use Vitest (`import {expect, test, vi} from "vitest"`) and add tests to `pnpm test` discovery (`vitest.config.mts`). The test environment is Node.
- Vitest requires Vite internally as a peer dependency; do not add a Vite app config or replace the xmcp/esbuild production build with Vite.
- `tsconfig.test.json` includes both `src/**/*.ts` and `test/**/*.ts`; preserve test type-checking when changing TypeScript configuration.
- Keep service tests isolated from network and external processes. Use fake fetchers, temporary filesystem paths, and mocked/fake subprocesses where needed.

## Build pipeline (non-obvious)

- `xmcp build` generates `.xmcp/` (adapter + `import-map.js`). These are generated — never hand-edit.
- `tsconfig.json` maps `@xmcp/*` → `./.xmcp/*`, so `@xmcp/adapter` resolves to the generated adapter.
- esbuild outputs CJS (`format: cjs`), so code relies on `__dirname` at runtime (see `src/ts/services/*`).
- `xmcp-env.d.ts` is generated — do not edit.

## Tool authoring

Each `src/ts/tools/*.tool.ts` exports `schema` (zod inputs), optional `outputSchema`, `metadata`, and a `default` async function.

Return convention:
- Tools with an `outputSchema` must return `{ structuredContent: { ... } }` (see `list_actions.tool.ts`, `list_examples.tool.ts`).
- Tools returning plain text return the string directly (see `get_schema.tool.ts`, `overview.tool.ts`).

## Versioning

- `src/ts/services/release-sync.service.ts` fetches paginated GitHub release metadata for `petriflow/petriflow`, caches the version list and latest stable version, and synchronizes missing published releases.
- Release assets are named `petriflow-vX.Y.Z.zip`. The archive root contains `petriflow.schema.xsd`, `overview.md`, `actions-definitions.json`, `elements/`, and `examples/`.
- Synchronization runs before the server starts listening and can be retried through `POST /admin/petriflow/sync`. Deployment infrastructure is responsible for endpoint authentication.
- `storage.service.ts` persists extracted release files under a versioned directory rooted at `StorageService.STORAGE_PATH` (`__dirname/storage`). A version becomes available only after a complete atomic install. Installed releases are immutable: synchronization does not overwrite or delete them.
- `cache.service.ts` is only for cache data (including release version metadata); release files belong in `storage.service.ts`.
- Tools and resources resolve `"latest"` through the synchronized latest-version cache. `list-versions` no longer needs to be called first.
- There is no local `public/fallback` data. Do not reintroduce fallback reads or copy release data into the MCP repository.

## Logging

- Use `logger` from `src/ts/services/logger.service` (named export). Never `console.log`.
- Do NOT pass a pino instance to `Fastify({logger})`: esbuild bundles pino separately from Fastify's copy, so Fastify's `instanceof pino` check fails. Pass a config object and call `setLogger(app.log)` (already done in `src/ts/index.ts`).

## Services

- `src/ts/services/cache.service.ts` — file-backed key-value cache singleton; the default file is `cache.json` under `__dirname`. It is for metadata/cache values, not release files.
- `src/ts/services/storage.service.ts` — versioned release-file storage with atomic install and read/list helpers. Its production path is intentionally unchanged.
- `src/ts/services/release-sync.service.ts` — GitHub release listing, SemVer latest selection, ZIP validation, synchronization, and version metadata cache.
- `src/ts/services/petriflow-data.service.ts` — shared readers for schema, overview, elements, action definitions, and examples. Tools, resources, and validation should use this service rather than reading files directly.
- `src/ts/services/version-completions.service.ts` — resource-template completion values from cached release metadata; completion must not fetch from GitHub.
- `src/ts/services/logger.service.ts` — `export let logger` (live binding) + `setLogger()`.
- `src/ts/services/utils.ts` — latest-version helper.
- `src/ts/services/schema.service.ts` — `getSchemaXsd(version)` delegates to `PetriflowDataService` (used by `get-schema` tool and `ValidationService`).
- `src/ts/services/validation.service.ts` — `ValidationService` singleton (default export). `validate(xml, version)` runs: well-formedness → XSD validation (`libxmljs2`) → registered semantic rules. Rules are registered at startup in `src/ts/index.ts`.
- `src/ts/services/action-validation.service.ts` — action/function compilation through a persistent Groovy subprocess. Pure reference helpers can be tested directly; daemon tests should use a fake child process rather than require Groovy.

## MCP Resources

- Resources are auto-discovered from `src/ts/resources/`; route groups in parentheses set the URI scheme and `[param]` segments create templates.
- Petriflow resources are grouped under `(petriflow)/versions/`. Every dynamic resource handler must export a default handler; export `complete` from each resource with a `{version}` parameter using the shared version-completion service.
- Resources and tools should call the same Petriflow data service. Structured tool payloads are represented as JSON text resources; file content is returned as text with an appropriate MIME type.

## Validation rules

- Semantic rules live in `src/ts/services/rules/*.rule.ts`, each exporting a `ValidationRule` (`{ name, description, validate(doc, ctx) }`).
- Register new rules in `src/ts/services/rules/index.ts` (`rules` array); they are wired into the service on startup.
- `src/ts/services/rules/helpers.ts` has shared DOM/XPath helpers (`childText`, `findRootChildren`, `isJavaIdentifier`, `JAVA_RESERVED_WORDS`, `GROOVY_RESERVED_WORDS`, `parseInteger`).
- `validate(doc, ctx)` receives a libxmljs2 `Document`; use `doc.find(xpath)` / element `.attr()` / `.text()`.
- `validate` may return a `Promise<ValidationIssue[]>` (the service `await`s every rule); `action-validation.rule.ts` is async (it drives the Groovy daemon).

## Native module: libxmljs2 (non-obvious)

- XML/XSD validation uses `libxmljs2`, a **native addon** (not pure JS). It must NOT be bundled:
  - `build.mjs` lists `external: ['libxmljs2']`.
  - Locally it needs to be compiled — pnpm build is enabled via `allowBuilds.libxmljs2 = true` in `pnpm-workspace.yaml` (and it needs `python3 make g++ libxml2-dev` to build from source; see `Dockerfile` build stage).
- The `.node` binary is required at runtime and is loaded via `require("libxmljs2")`, so the runtime image must contain `node_modules` (see `Dockerfile`).

## Notes

- `.github/workflows/build.yml` is fully commented out (inactive).
- The Dockerfile uses `npm ci` but the repo uses pnpm (`pnpm-lock.yaml`, no `package-lock.json`) — Docker deploy is currently broken/out of sync; fix the package manager or regenerate a lockfile before relying on it.

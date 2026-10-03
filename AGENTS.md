# AGENTS.md

MCP server for Petriflow, built on [xmcp](https://xmcp.dev) + Fastify. Tools are auto-discovered from `src/ts/tools/*.tool.ts`.

## Commands

- `pnpm dev` — build then run
- `pnpm build` — `xmcp build && node build.mjs` (regenerate `.xmcp/`, bundle to `dist/server.cjs`, copy `src/public` → `dist/public` and `src/groovy` → `dist/groovy`)
- `pnpm typecheck` — `tsc --noEmit` (the only static check; no test suite or lint script)
- `pnpm start` — run the already-built server (`node dist/server.cjs`)

Package manager is pnpm (Node >= 22). `pnpm-workspace.yaml` allows esbuild postinstall builds.

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

- Tools take a `version` param; `"latest"` resolves via `getLatestVersion()` (`src/ts/services/utils.ts`), which reads `cache.get("latestVersion")`.
- That cache key is populated only by the `list-versions` tool — `list-versions` must run before other tools resolve `"latest"`.
- `getVersionedPath(version, suffix)` resolves `public/v{version}/...`, falling back to `public/fallback/...`. Static content lives in `src/public/fallback/` (examples, `overview.md`, `actions-def.json`).

## Logging

- Use `logger` from `src/ts/services/logger.service` (named export). Never `console.log`.
- Do NOT pass a pino instance to `Fastify({logger})`: esbuild bundles pino separately from Fastify's copy, so Fastify's `instanceof pino` check fails. Pass a config object and call `setLogger(app.log)` (already done in `src/ts/index.ts`).

## Services

- `src/ts/services/cache.service.ts` — file-backed singleton (default export), `cache.json` + `cache.d/` under `__dirname`.
- `src/ts/services/logger.service.ts` — `export let logger` (live binding) + `setLogger()`.
- `src/ts/services/utils.ts` — `getLatestVersion()`, `getVersionedPath()`.
- `src/ts/services/schema.service.ts` — `getSchemaXsd(version)`: resolves/caches the XSD (used by `get-schema` tool and `ValidationService`).
- `src/ts/services/validation.service.ts` — `ValidationService` singleton (default export). `validate(xml, version)` runs: well-formedness → XSD validation (`libxmljs2`) → registered semantic rules. Rules are registered at startup in `src/ts/index.ts`.

## Validation rules

- Semantic rules live in `src/ts/services/rules/*.rule.ts`, each exporting a `ValidationRule` (`{ name, description, validate(doc, ctx) }`).
- Register new rules in `src/ts/services/rules/index.ts` (`rules` array); they are wired into the service on startup.
- `src/ts/services/rules/helpers.ts` has shared DOM/XPath helpers (`childText`, `findRootChildren`, `isJavaIdentifier`, `JAVA_RESERVED_WORDS`, `GROOVY_RESERVED_WORDS`, `parseInteger`).
- `validate(doc, ctx)` receives a libxmljs2 `Document`; use `doc.find(xpath)` / element `.attr()` / `.text()`.

## Native module: libxmljs2 (non-obvious)

- XML/XSD validation uses `libxmljs2`, a **native addon** (not pure JS). It must NOT be bundled:
  - `build.mjs` lists `external: ['libxmljs2']`.
  - Locally it needs to be compiled — pnpm build is enabled via `allowBuilds.libxmljs2 = true` in `pnpm-workspace.yaml` (and it needs `python3 make g++ libxml2-dev` to build from source; see `Dockerfile` build stage).
- The `.node` binary is required at runtime and is loaded via `require("libxmljs2")`, so the runtime image must contain `node_modules` (see `Dockerfile`).

## Notes

- `.github/workflows/build.yml` is fully commented out (inactive).
- The Dockerfile uses `npm ci` but the repo uses pnpm (`pnpm-lock.yaml`, no `package-lock.json`) — Docker deploy is currently broken/out of sync; fix the package manager or regenerate a lockfile before relying on it.

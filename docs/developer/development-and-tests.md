# Development and tests

## Setup and commands

Use Node.js 26.x and pnpm.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

`pnpm test` runs Vitest once. Tests live in `test/`, grouped by service and route. `tsconfig.test.json` type-checks both
application and test TypeScript. The Docsify site is static and is not part of the application build.

Vitest uses Vite internally as a peer dependency, but the production application build remains xmcp + esbuild. Do not
add a `vite.config` or use Vite to bundle the server.

The Docsify entry page loads the latest stable Docsify 5 release from jsDelivr (currently 5.0.0). Docsify CLI is not
installed; no application dependency or build step is needed for the documentation site.

Documentation is maintained as Markdown in `docs/`. When adding a page, place it under the matching audience directory
and add it to `docs/_sidebar.md`.

## Test boundaries

- Keep GitHub tests offline by injecting a fetcher and using ZIP fixtures.
- Use temporary filesystem locations for storage/cache tests.
- Use fake child processes for Groovy daemon protocol tests; the unit suite must not require a Groovy installation.
- Test XML rules directly with small `libxmljs5` documents. The `action-validation` rule should mock the daemon service
  while testing rule decisions.

## Native/runtime requirements

`libxmljs5` requires native build tools and libxml2 headers. The Groovy validation path additionally requires JVM 21 and
Groovy 4.0.x. See the [administrator installation guide](../admin/installation-and-config.md).

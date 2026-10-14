# petriflow.ai

An [MCP](https://modelcontextprotocol.io) server for [Petriflow](https://github.com/netgrif/petriflow), built with [xmcp](https://xmcp.dev) + Fastify. It exposes Petriflow tools to MCP-compatible AI clients over HTTP.

See the [project documentation](docs/README.md) for user, server administration, and developer guides.

## Getting Started

Requires Node.js >= 22.12.0 and pnpm.

```bash
pnpm install
pnpm dev        # build then run
```

This starts the MCP server on `http://localhost:3000` (the `/mcp` endpoint). Override the port with `PORT` or the bind address with `HOST`; the default host is loopback (`127.0.0.1`). Set `PETRIFLOW_MODE=LOCAL` to use the bundled Petriflow snapshot without GitHub, or leave it unset (`REMOTE`) to synchronize releases. The Docker image sets `HOST=0.0.0.0` for container port publishing.

## Commands

- `pnpm dev` — build then run the server
- `pnpm build` — `xmcp build && node build.mjs` (regenerates `.xmcp/`, bundles to `dist/server.cjs`, copies `src/public` → `dist/public`, `src/groovy` → `dist/groovy`, and `src/petriflow/snapshot` → `dist/petriflow/snapshot`)
- `pnpm typecheck` — type-check source and test files
- `pnpm test` — run Vitest once (no watch mode)
- `pnpm start` — run the already-built server

## Project Structure

- `src/ts/index.ts` — Fastify entrypoint (registers `@xmcp/adapter`, static files, validation rules)
- `src/ts/tools/` — MCP tool definitions, auto-discovered from `*.tool.ts`
- `src/ts/services/` — shared services for cache, storage, release synchronization, Petriflow data, and validation
- `src/ts/services/rules/` — semantic validation rules
- `src/ts/resources/` — MCP resources and resource templates
- `test/` — Vitest service and route tests
- `src/groovy/` — Groovy action-validation daemon (see `src/groovy/README.md`)
- `src/public/assets/` — logo/favicon

### Tools

Each `src/ts/tools/*.tool.ts` exports a `schema` (zod inputs), optional `outputSchema`, `metadata`, and a `default` function.

Current tools:

| Tool | Purpose |
|---|---|
| `list-versions` | List available Petriflow versions (flags the latest) |
| `get-schema` | Get the full XSD schema for a version |
| `get-overview` | Show the Petriflow language overview |
| `list-actions` | List available action functions |
| `get-action` | Get the definition of one action |
| `list-elements` | List Petriflow elements |
| `get-element` | Get the XSD schema of one element |
| `list-examples` | List example processes |
| `get-example` | Get the content of one example process |
| `validate-process` | Validate a process XML against its schema and semantic rules |
| `validate-action` | Validate a Petriflow action (Groovy code) by compiling it against the Petriflow DSL |

Tools with an `outputSchema` return `{ structuredContent: { ... } }`; the rest return plain text.

### Resources and release synchronization

Resources mirror the version, schema, overview, element, action, and example data exposed by the tools. Versioned resource templates use URIs such as `petriflow://versions/{version}/schema` and complete versions from the active catalog, including `latest`.

In `REMOTE` mode (the default), startup checks releases from `petriflow/petriflow` and installs missing assets named `petriflow-vX.Y.Z.zip`. In `LOCAL` mode, the server installs the single checked-in snapshot from `src/petriflow/snapshot/` and makes no GitHub requests. The snapshot includes `manifest.json` and the same schema, overview, actions, elements, and examples files as a release archive. `POST /admin/petriflow/sync` remains available in REMOTE mode and returns HTTP 409 in LOCAL mode. Installed releases are immutable and are not deleted or overwritten.

## Validation

`validate-process` runs a pipeline in `src/ts/services/validation.service.ts`:

1. XML well-formedness
2. XSD schema validation (via the native `libxmljs2` module)
3. registered semantic rules

Semantic rules live in `src/ts/services/rules/*.rule.ts` and are registered in `src/ts/services/rules/index.ts`. Each rule exports `{ name, description, validate(doc, ctx) }` and returns `ValidationIssue[]` (or a `Promise` of one) — `rule`, `severity`, `message`, optional `path`/`line`/`column`.

The `action-validation` rule compiles every `<action>` and every `<function>` in the process against the Petriflow DSL (via the Groovy daemon), checks that `f.*`/`t.*` references resolve to declared fields/transitions, and warns about unused functions.

`validate-action` compiles a single action's Groovy code against the Petriflow DSL in a persistent Groovy daemon. See `src/groovy/README.md` for details.

> `libxmljs2` is a native addon and must be compiled on install and present at runtime (see `Dockerfile`). The `action-validation` rule additionally requires a JVM + Groovy at runtime.

## Building for Production

```bash
pnpm build
```

## Running the Server

```bash
pnpm start            # node dist/server.cjs
```

## Learn More

- [Petriflow](https://github.com/netgrif/petriflow)
- [xmcp Documentation](https://xmcp.dev/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)

## License

Licensed under the [Apache License 2.0](./LICENSE.txt).

# petriflow.ai

An [MCP](https://modelcontextprotocol.io) server for [Petriflow](https://github.com/netgrif/petriflow), built with [xmcp](https://xmcp.dev) + Fastify. It exposes Petriflow tools to MCP-compatible AI clients over HTTP.

## Getting Started

Requires Node.js >= 22 and pnpm.

```bash
pnpm install
pnpm dev        # build then run
```

This starts the MCP server on `http://localhost:3000` (the `/mcp` endpoint). Override the port with the `PORT` env var.

## Commands

- `pnpm dev` — build then run the server
- `pnpm build` — `xmcp build && node build.mjs` (regenerates `.xmcp/`, bundles to `dist/server.cjs`, copies `src/public` → `dist/public` and `src/groovy` → `dist/groovy`)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm start` — run the already-built server

## Project Structure

- `src/ts/index.ts` — Fastify entrypoint (registers `@xmcp/adapter`, static files, validation rules)
- `src/ts/tools/` — MCP tool definitions, auto-discovered from `*.tool.ts`
- `src/ts/services/` — shared services (cache, logger, schema, validation, utils)
- `src/ts/services/rules/` — semantic validation rules
- `src/groovy/` — Groovy action-validation daemon (see `src/groovy/README.md`)
- `src/public/fallback/` — static content (examples, `overview.md`, `actions-def.json`, `elements/`)
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